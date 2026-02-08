import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = postgres(process.env.DATABASE_URL);

export interface Word {
  chinese: string;
  pinyin: string;
  english: string;
  created_at: Date;
  category: string;
  i: number;
  ef: number;
  n: number;
  example_chinese?: string;
  example_pinyin?: string;
}

export interface Review {
  id: string;
  chinese: string;
  user_id: string;
  created_at: Date;
  q: number;
}

