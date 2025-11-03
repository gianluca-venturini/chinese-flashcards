import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(process.env.DATABASE_URL);

export interface Word {
  id: number;
  chinese: string;
  pinyin: string;
  english: string;
  created_at: Date;
}

