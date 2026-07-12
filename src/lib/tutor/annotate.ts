import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const SentenceAnnotationSchema = z.object({
  pinyin: z.string().describe('Pinyin for the whole sentence, with tone marks (e.g. nǐ hǎo).'),
  english: z.string().describe('A natural English translation of the whole sentence.'),
});

export type SentenceAnnotation = z.infer<typeof SentenceAnnotationSchema>;

// Produce pinyin + English for a full Chinese sentence. Used to backfill the
// tutor's lines, whose text comes from the audio transcript (Hanzi only).
export async function annotateSentence(hanzi: string): Promise<SentenceAnnotation> {
  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    schema: SentenceAnnotationSchema,
    temperature: 0,
    system:
      'You are a Chinese language expert helping a beginner. Given a Chinese sentence, return its pinyin (with tone marks, e.g. "nǐ hǎo") and a natural English translation of the whole sentence. Return only those two fields.',
    prompt: hanzi,
  });

  return object;
}
