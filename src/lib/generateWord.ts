import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CATEGORY_RULES } from './categories';
import {
  GeneratedRowSchema,
  GENERATED_FIELDS,
  type GeneratedField,
  type GeneratedRow,
} from './schema';

const SYSTEM_PROMPT = `
You are an expert Chinese teacher who writes flashcards for language learners.

Your job: given ONE Chinese word, fill in the requested fields of its flashcard row.
Fill in only the requested fields.

Pinyin rules:
- Use tone marks (e.g. nǐ hǎo), not tone numbers.
- Separate syllables with a space.

English rules:
- Provide a short, learner-friendly translation (1-5 words typically).
- For words with multiple meanings, choose the most common/useful one.
- Separate multiple related meanings with a comma.
- Do not include pinyin or explanations, just the English translation.
- Examples: 家 → family, house; 旅行 → travel; 早上 → morning.

${CATEGORY_RULES}

Example sentence rules:
- Keep the sentence short: 4-10 characters ideal, 15 characters maximum.
- Prefer words from the known vocabulary list when possible.
- The sentence must be natural, grammatically correct and contain the word.
- example_chinese, example_pinyin and example_english are the SAME sentence:
  * example_pinyin is the pinyin of example_chinese, exactly, syllable for syllable, with the same punctuation.
  * example_english is a faithful, natural translation of example_chinese, not a word-by-word gloss.
  * Never write a different sentence in any of the three fields.
`;

export async function generateWordRow(input: {
  chinese: string;
  fields: readonly GeneratedField[];
  current?: Partial<GeneratedRow>;
  knownWords?: string[];
}): Promise<Partial<GeneratedRow>> {
  const { chinese, fields, current, knownWords } = input;
  if (fields.length === 0) return {};

  // Keep the schema field order (the example sentence comes before its pinyin).
  const asked = GENERATED_FIELDS.filter((f) => fields.includes(f));
  const schema = GeneratedRowSchema.pick(
    Object.fromEntries(asked.map((f) => [f, true])) as Record<GeneratedField, true>,
  );

  const lines = [`Word: ${chinese}`, `Requested fields: ${asked.join(', ')}`];
  const known = Object.entries(current ?? {}).filter(([, v]) => v != null && v !== '');
  if (known.length > 0) {
    lines.push(`Current values:\n${known.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
  }
  if (knownWords && knownWords.length > 0) {
    lines.push(`Known vocabulary:\n${knownWords.join(', ')}`);
  }

  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    schema,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    prompt: lines.join('\n\n'),
  });

  return object as Partial<GeneratedRow>;
}
