import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';
import { parsePlecoXML } from '@/lib/parsePlecoXML';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', success: false },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    
    // Parse XML
    const parsedWords = parsePlecoXML(fileContent);
    
    if (parsedWords.length === 0) {
      return NextResponse.json(
        { error: 'No words found in file', success: false },
        { status: 400 }
      );
    }

    // Insert words into database
    let insertedCount = 0;
    for (const word of parsedWords) {
      try {
        await sql`
          INSERT INTO words (chinese, pinyin, english, user_id)
          VALUES (${word.chinese}, ${word.pinyin}, ${word.english}, ${user.id})
          ON CONFLICT (chinese, user_id) DO NOTHING
        `;
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting word ${word.chinese}:`, error);
        // Continue with other words even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      count: insertedCount,
      total: parsedWords.length,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to process file', success: false },
      { status: 500 }
    );
  }
}

