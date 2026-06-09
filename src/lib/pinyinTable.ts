type PinyinTable = Map<string, string>;

const TABLE_URL = '/data/hanzi-pinyin-table.json';

async function loadTable(): Promise<PinyinTable> {
  const res = await fetch(TABLE_URL);
  if (!res.ok) throw new Error(`pinyin table fetch failed: ${res.status}`);
  const parsed = (await res.json()) as Record<string, string[]>;
  const table: PinyinTable = new Map();
  for (const [hanzi, readings] of Object.entries(parsed)) {
    if (Array.isArray(readings) && readings.length > 0) {
      table.set(hanzi, readings[0]);
    }
  }
  return table;
}

function lookup(word: string, table: PinyinTable): { pinyin: string; complete: boolean } {
  const parts: string[] = [];
  let complete = true;
  for (const ch of Array.from(word)) {
    const reading = table.get(ch);
    if (reading) {
      parts.push(reading);
    } else {
      parts.push(ch);
      complete = false;
    }
  }
  return { pinyin: parts.join(' '), complete };
}

export async function lookupPinyinForWord(
  word: string,
): Promise<{ pinyin: string; complete: boolean }> {
  const table = await loadTable();
  return lookup(word, table);
}

export async function lookupPinyinForWords(
  words: string[],
): Promise<{ word: string; pinyin: string; complete: boolean }[]> {
  const table = await loadTable();
  return words.map((word) => ({ word, ...lookup(word, table) }));
}
