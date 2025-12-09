import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';

class WordNotFoundError extends Error {
  constructor() {
    super('Word not found');
    this.name = 'WordNotFoundError';
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check if user is authenticated
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { chinese, english } = body;

    // Validate required parameters
    if (!chinese || typeof chinese !== 'string') {
      return NextResponse.json(
        { error: 'chinese parameter is required and must be a string', success: false },
        { status: 400 }
      );
    }

    if (!english || typeof english !== 'string') {
      return NextResponse.json(
        { error: 'english parameter is required and must be a string', success: false },
        { status: 400 }
      );
    }

    // Check if word exists and update within a transaction
    await sql.begin(async (sql) => {
      // Check if word exists for this user
      const existingWord = await sql`
        SELECT chinese
        FROM words
        WHERE chinese = ${chinese} AND user_id = ${user.id}
        LIMIT 1
      `;

      if (existingWord.length === 0) {
        throw new WordNotFoundError();
      }

      // Update the English translation
      await sql`
        UPDATE words
        SET english = ${english}
        WHERE chinese = ${chinese} AND user_id = ${user.id}
      `;
    });

    return NextResponse.json({
      success: true,
      message: 'Word updated successfully'
    });
  } catch (error) {
    // Handle "Word not found" error specifically
    if (error instanceof WordNotFoundError) {
      return NextResponse.json(
        { error: 'Word not found', success: false },
        { status: 404 }
      );
    }

    console.error('Error updating word:', error);
    return NextResponse.json(
      { error: 'Failed to update word', success: false },
      { status: 500 }
    );
  }
}

