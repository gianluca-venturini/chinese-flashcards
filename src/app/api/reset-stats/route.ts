import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';

export const runtime = 'edge';

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

    // Reset all stats for the current user to default values
    await sql`
      UPDATE words
      SET
        n = DEFAULT,
        ef = DEFAULT,
        i = DEFAULT,
        last_review_applied_timestamp = NULL
      WHERE user_id = ${user.id}
    `;

    return NextResponse.json({ 
      success: true,
      message: 'Stats reset successfully'
    });
  } catch (error) {
    console.error('Error resetting stats:', error);
    return NextResponse.json(
      { error: 'Failed to reset stats', success: false },
      { status: 500 }
    );
  }
}

