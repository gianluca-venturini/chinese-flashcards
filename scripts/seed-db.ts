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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Insert sample data
    console.log('Inserting sample data...');
    await sql`
      INSERT INTO words (chinese, pinyin, english) VALUES
        ('你好', 'nǐ hǎo', 'Hello'),
        ('再见', 'zài jiàn', 'Goodbye'),
        ('谢谢', 'xiè xiè', 'Thank you'),
        ('对不起', 'duì bù qǐ', 'Sorry'),
        ('是', 'shì', 'Yes/To be'),
        ('不是', 'bú shì', 'No/Not to be'),
        ('我', 'wǒ', 'I/Me'),
        ('你', 'nǐ', 'You'),
        ('他', 'tā', 'He/Him'),
        ('她', 'tā', 'She/Her'),
        ('好', 'hǎo', 'Good'),
        ('坏', 'huài', 'Bad'),
        ('大', 'dà', 'Big'),
        ('小', 'xiǎo', 'Small'),
        ('多少', 'duō shǎo', 'How much/How many'),
        ('什么', 'shén me', 'What'),
        ('哪里', 'nǎ lǐ', 'Where'),
        ('为什么', 'wèi shén me', 'Why'),
        ('怎么', 'zěn me', 'How'),
        ('现在', 'xiàn zài', 'Now')
      ON CONFLICT DO NOTHING
    `;

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

