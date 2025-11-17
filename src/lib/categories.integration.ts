import { test, expect } from "bun:test";
import { classifyChineseWord, classifyChineseWords, CATEGORY_IDS } from "./categories";

test("classifyChineseWord returns a valid CategoryId", async () => {
  const result = await classifyChineseWord("我");

  expect(CATEGORY_IDS).toContain(result);
  expect(typeof result).toBe("string");
});

test("classifyChineseWord categorizes people & identity words correctly", async () => {
  const words = ["我", "你", "他", "她", "老师", "同学"];

  for (const word of words) {
    const result = await classifyChineseWord(word);
    expect(result).toBe("people_identity");
  }
}, { timeout: 30000 });

test("classifyChineseWords batch classifies multiple words", async () => {
  const words = ["我", "头", "家", "米饭", "学校"];
  const results = await classifyChineseWords(words);

  expect(results).toHaveLength(words.length);
  results.forEach((result) => {
    expect(CATEGORY_IDS).toContain(result.category);
    expect(words).toContain(result.word);
  });

  // Verify each input word has a corresponding result
  const resultWords = results.map((r) => r.word);
  words.forEach((word) => {
    expect(resultWords).toContain(word);
  });
}, { timeout: 30000 });
