import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const CATEGORY_IDS = [
  'people_identity',
  'body_health',
  'home_objects_daily',
  'food_restaurant_shopping',
  'places_transport_travel',
  'nature_weather_environment',
  'time_numbers_measure',
  'school_work_technology',
  'feelings_thoughts_communication',
  'society_culture_hobbies',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_META: Record<
CategoryId,
{
    label: string;
    description: string;
    examples: string[];
}
> = {
  people_identity: {
    label: 'People & Identity',
    description: 'Basic pronouns, names, family & social roles.',
    examples: ['我', '你', '他', '她', '名字', '家人', '父母', '孩子', '老师', '同学'],
  },
  body_health: {
    label: 'Body & Health',
    description: 'Body parts, feeling sick/well, at the doctor.',
    examples: ['头', '手', '眼睛', '肚子', '生病', '痛', '医院', '药'],
  },
  home_objects_daily: {
    label: 'Home, Objects & Daily Routines',
    description: 'House, furniture, clothing, daily routine verbs.',
    examples: ['家', '房间', '床', '桌子', '衣服', '起床', '吃饭', '洗澡', '睡觉'],
  },
  food_restaurant_shopping: {
    label: 'Food, Restaurants & Shopping',
    description: 'Food/drink, restaurants, markets, prices.',
    examples: ['米饭', '面条', '水', '茶', '菜', '餐厅', '菜单', '买', '卖', '多少钱'],
  },
  places_transport_travel: {
    label: 'Places, Transport & Travel',
    description: 'City places, countries, transport, directions.',
    examples: ['学校', '银行', '公园', '中国', '美国', '火车', '飞机', '左', '右'],
  },
  nature_weather_environment: {
    label: 'Nature, Weather & Environment',
    description: 'Weather, seasons, natural world.',
    examples: ['天气', '热', '冷', '下雨', '刮风', '春天', '夏天', '山', '河', '公园'],
  },
  time_numbers_measure: {
    label: 'Time, Numbers & Measure Words',
    description: 'Numbers, time expressions, calendar, classifiers.',
    examples: ['一', '两', '三', '年', '月', '日', '点', '个', '本', '只'],
  },
  school_work_technology: {
    label: 'School, Work & Technology',
    description: 'School subjects, jobs, office, devices, apps.',
    examples: ['学校', '课程', '考试', '老板', '公司', '工程师', '手机', '电脑', '软件', '网络'],
  },
  feelings_thoughts_communication: {
    label: 'Feelings, Thoughts & Communication',
    description: 'Emotions, opinions, mental verbs, communication verbs.',
    examples: ['喜欢', '爱', '生气', '害怕', '担心', '觉得', '说', '问', '告诉'],
  },
  society_culture_hobbies: {
    label: 'Society, Culture & Hobbies',
    description: 'Festivals, holidays, politics, media, sports, arts, hobbies.',
    examples: ['春节', '中秋节', '文化', '电影', '电视', '音乐', '足球', '爱好', '政府', '法律'],
  },
};

/** This is a categorization prompt that asks the LLM to categorize a word into one of the categories. */
const CATEGORY_SYSTEM_PROMPT = `
You are an expert classifier for single Chinese words (usually 1-3 characters long).

Your job: given ONE word, choose exactly ONE category ID from this list:

${CATEGORY_IDS.map((category) => `- ${category} – ${CATEGORY_META[category].description}`).join('\n')}

Rules:

- Input is usually a single word with no context, so choose its most typical beginner-level dictionary sense.  
- If it fits multiple categories, pick the one that is most useful in a learner-friendly word list.

  * Pure place names (like 学校, 银行, 公园, 国家名) → default to "places_transport_travel".
  * Jobs or roles (老师, 工程师, 医生) → "people_identity" (they are people).
  * Abstract school/work nouns (课程, 考试, 公司, 工作) → "school_work_technology".
  * Pure place names (like 学校, 银行, 公园, 国家名) → default to "places_transport_travel".
  * Jobs or roles (老师, 工程师, 医生) → "people_identity" (they are people).
  * Abstract school/work nouns (课程, 考试, 公司, 工作) → "school_work_technology".

- If the word is clearly about food or buying/selling, always use "food_restaurant_shopping".
- If it's clearly an emotion or mental/communication verb, use "feelings_thoughts_communication".
- Always answer with ONLY the category ID string (for example: people_identity).
`;

/** @deprecated because it's too slow. Use classifyChineseWords instead. */
export async function classifyChineseWord(
  word: string,
): Promise<CategoryId> {
  const { object: category } = await generateObject({
    model: openai('gpt-4.1'),
    output: 'enum',
    enum: [...CATEGORY_IDS],
    temperature: 0,
    system: CATEGORY_SYSTEM_PROMPT,
    prompt: `${word}`,
  });

  return category as CategoryId;
}

/** Batch version of the categorization prompt for multiple words. */
const BATCH_CATEGORY_SYSTEM_PROMPT = `
You are an expert classifier for single Chinese words (usually 1-3 characters long).

Your job: given a list of words, classify each word into exactly ONE category ID from this list:

${CATEGORY_IDS.map((category) => `- ${category} – ${CATEGORY_META[category].description}`).join('\n')}

Rules:

- Input is usually a single word with no context, so choose its most typical beginner-level dictionary sense.  
- If it fits multiple categories, pick the one that is most useful in a learner-friendly word list.

  * Pure place names (like 学校, 银行, 公园, 国家名) → default to "places_transport_travel".
  * Jobs or roles (老师, 工程师, 医生) → "people_identity" (they are people).
  * Abstract school/work nouns (课程, 考试, 公司, 工作) → "school_work_technology".

- If the word is clearly about food or buying/selling, always use "food_restaurant_shopping".
- If it's clearly an emotion or mental/communication verb, use "feelings_thoughts_communication".
- Return an array with one classification per word, maintaining the same order as the input.
`;

const ClassificationSchema = z.object({
  word: z.string(),
  category: z.enum([...CATEGORY_IDS] as [string, ...string[]]),
});

const BatchClassificationSchema = z.object({
  classifications: z.array(ClassificationSchema),
});

export async function classifyChineseWords(
  words: string[],
): Promise<{ word: string; category: CategoryId }[]> {
  if (words.length === 0) {
    return [];
  }

  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    schema: BatchClassificationSchema,
    temperature: 0,
    system: BATCH_CATEGORY_SYSTEM_PROMPT,
    prompt: `Classify these Chinese words:\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`,
  });

  return object.classifications as { word: string; category: CategoryId }[];
}
