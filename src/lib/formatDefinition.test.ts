import { test, expect } from "bun:test";
import { getShortDefinition } from "./formatDefinition";

test("getShortDefinition extracts text before semicolon", () => {
  expect(getShortDefinition("noun doctor; medical man")).toBe("noun doctor");
  expect(getShortDefinition("noun town; city")).toBe("noun town");
});

test("getShortDefinition extracts text before period", () => {
  expect(getShortDefinition("noun 1 family. household")).toBe("noun 1 family");
  expect(getShortDefinition("verb make things convenient. for sb")).toBe("verb make things convenient");
});

test("getShortDefinition uses whichever comes first (semicolon or period)", () => {
  expect(getShortDefinition("noun 1 family; household 2 home")).toBe("noun 1 family");
  expect(getShortDefinition("noun 1 family. household; 2 home")).toBe("noun 1 family");
});

test("getShortDefinition returns full definition if no semicolon or period", () => {
  expect(getShortDefinition("engineer")).toBe("engineer");
  expect(getShortDefinition("noun instant noodles")).toBe("noun instant noodles");
});

test("getShortDefinition handles empty strings", () => {
  expect(getShortDefinition("")).toBe("");
});

test("getShortDefinition trims whitespace", () => {
  expect(getShortDefinition("  noun doctor; medical man  ")).toBe("noun doctor");
  expect(getShortDefinition("  engineer  ")).toBe("engineer");
});

test("getShortDefinition handles real-world example from flash.xml", () => {
  // From "家" card: "noun 1 family; household 2 home..."
  expect(getShortDefinition("noun 1 family; household 2 home 3 person")).toBe("noun 1 family");

  // From "医生" card: "noun doctor; medical man"
  expect(getShortDefinition("noun doctor; medical man")).toBe("noun doctor");

  // From "城市" card: "noun town; city"
  expect(getShortDefinition("noun town; city")).toBe("noun town");
});

