import { sql } from "./db";

/** Updates the Spaced Repetition variables for the specified word using the SM-2 algorithm.
 * Note that this function accesses the database directly, so it should be called after the review has been recorded.
 */
export async function applyReviews(user_id: string, chinese: string) {
  const reviews = await sql`
        SELECT * FROM reviews
        WHERE chinese = ${chinese}
            AND user_id = ${user_id}
            AND created_at > COALESCE(
                (SELECT last_review_applied_timestamp FROM words WHERE chinese = ${chinese} AND user_id = ${user_id}),
                '1970-01-01'::timestamp with time zone
            )
        ORDER BY created_at DESC
    `;
  const words = await sql`
        SELECT * FROM words
        WHERE chinese = ${chinese}
            AND user_id = ${user_id}
    `;

  if (words.length !== 1) {
    throw new Error(`Expected 1 word, got ${words.length}`);
  }
  if (reviews.length < 1) {
    // Optimization: nothing to do here
    return;
  }
  const word = words[0];

  // Execute the update following the SM-2 algorithm
  let n: number = word['n'];
  let ef: number = word['ef'];
  let i: number = word['i'];
  let last_review_applied_timestamp: string | null = null;
  for (const review of reviews) {
    const q: number = review['q'];
    last_review_applied_timestamp = review['created_at'];
    n = n + 1;
    ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    i = i + 1;
  }
  await sql`
        UPDATE words
        SET
            n = ${n},
            ef = ${ef},
            i = ${i},
            last_review_applied_timestamp = ${last_review_applied_timestamp}
        WHERE chinese = ${chinese}
            AND user_id = ${user_id}
    `;
}
