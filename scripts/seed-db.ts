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
    // Create table
    console.log('Creating words table...');
    await sql`
      CREATE TABLE IF NOT EXISTS words (
        chinese TEXT PRIMARY KEY,
        pinyin TEXT NOT NULL,
        english TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT fk_user
          FOREIGN KEY (user_id)
          REFERENCES neon_auth.users_sync(id)
          ON DELETE CASCADE
      )
    `;

    // Insert sample data (only if there's at least one user)
    console.log('Inserting sample data...');
    const users = await sql`
      SELECT id FROM neon_auth.users_sync WHERE email = 'gianluca.91@gmail.com' LIMIT 1
    `;
    
    if (users.length > 0) {
      const userId = users[0].id;
      await sql`
        INSERT INTO words (chinese, pinyin, english, user_id) VALUES
          ('你好', 'nǐ hǎo', 'Hello', ${userId}),
          ('再见', 'zài jiàn', 'Goodbye', ${userId}),
          ('谢谢', 'xiè xiè', 'Thank you', ${userId}),
          ('对不起', 'duì bù qǐ', 'Sorry', ${userId}),
          ('是', 'shì', 'Yes/To be', ${userId}),
          ('不是', 'bú shì', 'No/Not to be', ${userId}),
          ('我', 'wǒ', 'I/Me', ${userId}),
          ('你', 'nǐ', 'You', ${userId}),
          ('他', 'tā', 'He/Him', ${userId}),
          ('她', 'tā', 'She/Her', ${userId}),
          ('好', 'hǎo', 'Good', ${userId}),
          ('坏', 'huài', 'Bad', ${userId}),
          ('大', 'dà', 'Big', ${userId}),
          ('小', 'xiǎo', 'Small', ${userId}),
          ('多少', 'duō shǎo', 'How much/How many', ${userId}),
          ('什么', 'shén me', 'What', ${userId}),
          ('哪里', 'nǎ lǐ', 'Where', ${userId}),
          ('为什么', 'wèi shén me', 'Why', ${userId}),
          ('怎么', 'zěn me', 'How', ${userId}),
          ('现在', 'xiàn zài', 'Now', ${userId})
        ON CONFLICT DO NOTHING
      `;
      console.log('✅ Sample data inserted');
    } else {
      console.log('⚠️  No users found in neon_auth.users.sync, skipping sample data');
    }

    // Read the rows in the words table
    const words = await sql`
      SELECT * FROM words
    `;
    console.log(`\n📊 Total words in database: ${words.length}`);

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

void seed();

