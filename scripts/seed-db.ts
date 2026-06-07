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
        english TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        n INTEGER DEFAULT 0,
        ef DOUBLE PRECISION DEFAULT 2.5,
        i INTEGER DEFAULT 1,
        category TEXT,
        example_chinese TEXT,
        example_pinyin TEXT,
        last_reviewed_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        deprecated BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (chinese, user_id),
        CONSTRAINT fk_user
          FOREIGN KEY (user_id)
          REFERENCES neon_auth.users_sync(id)
          ON DELETE CASCADE
      )
    `;

    // Add columns for existing installs
    await sql`ALTER TABLE words ADD COLUMN IF NOT EXISTS example_chinese TEXT`;
    await sql`ALTER TABLE words ADD COLUMN IF NOT EXISTS example_pinyin TEXT`;
    await sql`ALTER TABLE words ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE words ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE words ADD COLUMN IF NOT EXISTS deprecated BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE words ALTER COLUMN english DROP NOT NULL`;

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

void seed();
