import { test, expect } from "bun:test";
import { generateWordRow } from "./generateWord";
import { CATEGORY_IDS } from "./categories";
import { GENERATED_FIELDS } from "./schema";

const HANZI = /\p{Script=Han}/gu;

test("generateWordRow makes a full row with a matching example", async () => {
  const row = await generateWordRow({ chinese: "同学", fields: GENERATED_FIELDS, knownWords: ["我", "学校", "去"] });

  for (const field of GENERATED_FIELDS) {
    expect(typeof row[field]).toBe("string");
    expect(row[field]!.length).toBeGreaterThan(0);
  }
  expect(CATEGORY_IDS).toContain(row.category!);
  expect(row.example_chinese).toContain("同学");

  // example_pinyin must be the pinyin of example_chinese: one syllable per character.
  const characters = row.example_chinese!.match(HANZI)!.length;
  const syllables = row.example_pinyin!.split(/[^\p{L}]+/u).filter(Boolean).length;
  expect(syllables).toBe(characters);
}, { timeout: 30000 });

test("generateWordRow returns only the requested fields", async () => {
  const row = await generateWordRow({ chinese: "老师", fields: ["english"] });
  expect(Object.keys(row)).toEqual(["english"]);
  expect(row.english!.toLowerCase()).toContain("teacher");
}, { timeout: 30000 });
