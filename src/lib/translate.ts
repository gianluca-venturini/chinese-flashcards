import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const TRANSLATION_SYSTEM_PROMPT = `
You are an expert Chinese-to-English translator for language learners.

Your job: given a list of Chinese words, provide a concise English translation for each.

Rules:
- Provide short, learner-friendly translations (1-5 words typically)
- For words with multiple meanings, choose the most common/useful one
- Separate multiple related meanings with a comma
- Do not include pinyin or explanations, just the English translation
- Return translations in the same order as the input words

Examples of good translations:
- 家 → family, house
- 旅行 → travel
- 早上 → morning
`;

const TranslationSchema = z.object({
  word: z.string().describe('The original Chinese word'),
  english: z.string().describe('The English translation'),
});

const BatchTranslationSchema = z.object({
  translations: z.array(TranslationSchema),
});

export type TranslationResult = z.infer<typeof TranslationSchema>;

export async function translateChineseWords(
  words: string[],
): Promise<TranslationResult[]> {
  if (words.length === 0) {
    return [];
  }

  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    schema: BatchTranslationSchema,
    temperature: 0,
    system: TRANSLATION_SYSTEM_PROMPT,
    prompt: `Translate these Chinese words to English:\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`,
  });

  return object.translations;
}
