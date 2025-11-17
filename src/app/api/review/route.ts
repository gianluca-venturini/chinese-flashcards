import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';
import {applyReviews} from '../../../lib/reviews';

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

    // Parse request body
    const body = await request.json();
    const { id, chinese, q, timestamp } = body;

    // Validate required parameters
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'id parameter is required and must be a string (UUIDv7)', success: false },
        { status: 400 }
      );
    }

    if (!chinese || typeof chinese !== 'string') {
      return NextResponse.json(
        { error: 'chinese parameter is required and must be a string', success: false },
        { status: 400 }
      );
    }

    if (q === undefined || typeof q !== 'number') {
      return NextResponse.json(
        { error: 'q parameter is required and must be a number', success: false },
        { status: 400 }
      );
    }

    // Validate q is between 0 and 5 (inclusive)
    if (q < 0 || q > 5 || !Number.isInteger(q)) {
      return NextResponse.json(
        { error: 'q parameter must be an integer between 0 and 5 (inclusive)', success: false },
        { status: 400 }
      );
    }

    // Validate timestamp if provided
    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json(
        { error: 'timestamp parameter is required and must be a string', success: false },
        { status: 400 }
      );
    }

    // Store review in database
    await sql`
      INSERT INTO reviews (id, chinese, user_id, q, created_at)
      VALUES (${id}, ${chinese}, ${user.id}, ${q}, ${timestamp})
    `;

    await applyReviews(user.id, chinese);

    return NextResponse.json({
      success: true,
      message: 'Review recorded successfully'
    });
  } catch (error) {
    console.error('Error recording review:', error);
    return NextResponse.json(
      { error: 'Failed to record review', success: false },
      { status: 500 }
    );
  }
}

