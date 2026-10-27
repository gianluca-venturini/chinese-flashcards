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

/** Rules that tell the LLM how to pick one category ID for a word. */
export const CATEGORY_RULES = `
Choose exactly ONE category ID from this list:

${CATEGORY_IDS.map((category) => `- ${category} – ${CATEGORY_META[category].description}`).join('\n')}

Category rules:

- The word usually has no context, so choose its most typical beginner-level dictionary sense.
- If it fits multiple categories, pick the one that is most useful in a learner-friendly word list.

  * Pure place names (like 学校, 银行, 公园, 国家名) → default to "places_transport_travel".
  * Jobs or roles (老师, 工程师, 医生) → "people_identity" (they are people).
  * Abstract school/work nouns (课程, 考试, 公司, 工作) → "school_work_technology".

- If the word is clearly about food or buying/selling, always use "food_restaurant_shopping".
- If it's clearly an emotion or mental/communication verb, use "feelings_thoughts_communication".
`;
