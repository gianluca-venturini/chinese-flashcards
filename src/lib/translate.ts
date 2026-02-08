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

const PinyinSchema = z.object({
  pinyin: z.string().describe('The pinyin with tone marks (e.g. nǐ hǎo)'),
});

export async function generatePinyin(chinese: string): Promise<string> {
  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    schema: PinyinSchema,
    temperature: 0,
    system: 'You are a Chinese language expert. Given a Chinese word or phrase, return its pinyin with tone marks (e.g. nǐ hǎo). Return only the pinyin, nothing else.',
    prompt: chinese,
  });

  return object.pinyin;
}

const EXAMPLE_SYSTEM_PROMPT = `
You are an expert Chinese teacher creating example sentences for language learners.

Your job: given a list of target Chinese words and a list of known vocabulary, create a short example sentence for each target word.

Rules:
- Keep sentences short: 4-10 characters ideal, 15 characters maximum
- Prefer using words from the known vocabulary list when possible
- Sentences must be natural and grammatically correct
- Each sentence must contain the target word
- Return sentences in the same order as the input words
`;

const ExampleSchema = z.object({
  word: z.string().describe('The original Chinese word'),
  example_chinese: z.string().describe('A short example sentence in Chinese'),
});

const BatchExampleSchema = z.object({
  sentences: z.array(ExampleSchema),
});

export type ExampleResult = z.infer<typeof ExampleSchema>;

export async function generateExampleSentences(
  targetWords: string[],
  knownWords: string[],
): Promise<ExampleResult[]> {
  if (targetWords.length === 0) {
    return [];
  }

  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    schema: BatchExampleSchema,
    temperature: 0.7,
    system: EXAMPLE_SYSTEM_PROMPT,
    prompt: `Target words:\n${targetWords.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\nKnown vocabulary:\n${knownWords.join(', ')}`,
  });

  return object.sentences;
}

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
