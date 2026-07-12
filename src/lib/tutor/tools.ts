import { z } from 'zod';

// The two display tools the tutor calls alongside its audio. Kept minimal —
// only the fields the UI renders. See specs/voice-tutor-session.

export const DisplayUtteranceSchema = z.object({
  hanzi: z.string(),
  pinyin: z.string(),
  english: z.string(),
});
export type DisplayUtteranceArgs = z.infer<typeof DisplayUtteranceSchema>;

export const ShowCorrectionSchema = z.object({
  targetHanzi: z.string(),
  targetPinyin: z.string(),
  description: z.string(),
});
export type ShowCorrectionArgs = z.infer<typeof ShowCorrectionSchema>;

/**
 * Function-tool definitions passed to the realtime session in `session.update`.
 * The `parameters` are plain JSON Schema, mirroring the zod schemas above.
 */
export const REALTIME_TOOLS = [
  {
    type: 'function' as const,
    name: 'display_utterance',
    description:
      'Render an ordinary sentence the tutor speaks. Call for EVERY ordinary (non-correction) sentence. Pinyin must use tone marks, e.g. "nǐ hǎo".',
    parameters: {
      type: 'object',
      properties: {
        hanzi: { type: 'string', description: 'The sentence in Chinese characters.' },
        pinyin: { type: 'string', description: 'Pinyin with tone marks, e.g. "nǐ hǎo".' },
        english: { type: 'string', description: 'A concise English translation.' },
      },
      required: ['hanzi', 'pinyin', 'english'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'show_correction',
    description:
      'Render a pronunciation OR grammar correction. Call only when correcting the learner; a correction is never a display_utterance.',
    parameters: {
      type: 'object',
      properties: {
        targetHanzi: { type: 'string', description: 'The word/phrase being corrected, in Chinese.' },
        targetPinyin: { type: 'string', description: 'Pinyin of the target, with tone marks.' },
        description: {
          type: 'string',
          description:
            'Free-form explanation of the mistake and the fix, matching what you say aloud; mixing Chinese and English is fine.',
        },
      },
      required: ['targetHanzi', 'targetPinyin', 'description'],
      additionalProperties: false,
    },
  },
];
