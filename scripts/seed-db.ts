import { sql } from '@/lib/db';

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL in your .env.local file');
    process.exit(1);
  }

  console.log('🌱 Seeding database...');

  try {
    console.log('Creating words table...');
    await sql`
      CREATE TABLE IF NOT EXISTS words (
        chinese TEXT NOT NULL,
        user_id TEXT NOT NULL,
        pinyin TEXT NOT NULL,
        english TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        n INTEGER DEFAULT 0,
        ef DOUBLE PRECISION DEFAULT 2.5,
        i INTEGER DEFAULT 1,
        last_review_applied_timestamp TIMESTAMP WITH TIME ZONE,
        category TEXT,
        PRIMARY KEY (chinese, user_id),
        CONSTRAINT fk_user
          FOREIGN KEY (user_id)
          REFERENCES neon_auth.users_sync(id)
          ON DELETE CASCADE
      )
    `;

    console.log('Creating reviews table...');
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY,
        chinese TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        q INTEGER NOT NULL,
        CONSTRAINT fk_word
          FOREIGN KEY (chinese, user_id)
          REFERENCES words(chinese, user_id)
          ON DELETE CASCADE
      )
    `;

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

void seed();

