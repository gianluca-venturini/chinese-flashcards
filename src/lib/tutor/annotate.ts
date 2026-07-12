import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const SentenceAnnotationSchema = z.object({
  pinyin: z
    .string()
    .describe('Pinyin, with tone marks (e.g. nǐ hǎo), for the ENTIRE input — every sentence and clause.'),
  english: z
    .string()
    .describe('A natural English translation of the ENTIRE input — every sentence and clause.'),
});

export type SentenceAnnotation = z.infer<typeof SentenceAnnotationSchema>;

// Produce pinyin + English for the tutor's text. Used to backfill the tutor's
// lines, whose text comes from the audio transcript (Hanzi only). The input may
// contain multiple sentences and embedded example phrases.
export async function annotateSentence(hanzi: string): Promise<SentenceAnnotation> {
  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    schema: SentenceAnnotationSchema,
    temperature: 0,
    system:
      'You are a Chinese language expert helping a beginner. You are given Chinese text that may contain multiple sentences and embedded example phrases. Transliterate the ENTIRE text to pinyin (with tone marks, e.g. "nǐ hǎo") and translate the ENTIRE text to natural English. Cover every sentence and clause exactly as given — never omit, summarize, or annotate only part of it (e.g. only a quoted example). Return only those two fields.',
    prompt: hanzi,
  });

  return object;
}
