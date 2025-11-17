import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';
import { classifyChineseWords } from '@/lib/categories';

export async function POST() {
  try {
    // Check if user is authenticated
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Fetch all words for the current user without a category
    const words = await sql`
      SELECT chinese, pinyin, english, category
      FROM words
      WHERE user_id = ${user.id}
        AND category IS NULL
    `;

    if (words.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No words found to classify',
        classified: 0,
        total: 0,
      });
    }

    // Extract Chinese words for batch classification
    const chineseWords = words.map((w) => w.chinese);

    // Classify all words in a single batch call
    let classifiedCount = 0;
    let errorCount = 0;

    try {
      const classifications = await classifyChineseWords(chineseWords);
      console.log(`Batch classified ${classifications.length} words`);

      // Create a map for quick lookup
      const categoryMap = new Map(
        classifications.map((c) => [c.word, c.category])
      );

      // Update each word with its classification
      for (const word of words) {
        const category = categoryMap.get(word.chinese);
        if (category) {
          try {
            await sql`
              UPDATE words
              SET category = ${category}
              WHERE chinese = ${word.chinese} AND user_id = ${user.id}
            `;
            console.log(`Classified word ${word.chinese} as ${category}`);
            classifiedCount++;
          } catch (error) {
            console.error(`Error updating word ${word.chinese}:`, error);
            errorCount++;
          }
        } else {
          console.error(`No classification found for word ${word.chinese}`);
          errorCount++;
        }
      }
    } catch (error) {
      console.error('Error in batch classification:', error);
      errorCount = words.length;
    }

    return NextResponse.json({
      success: true,
      message: 'Classification completed',
      classified: classifiedCount,
      errors: errorCount,
      total: words.length,
    });
  } catch (error) {
    console.error('Error classifying words:', error);
    return NextResponse.json(
      { error: 'Failed to classify words', success: false },
      { status: 500 }
    );
  }
}

