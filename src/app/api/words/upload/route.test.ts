import { test, expect } from "bun:test";
import { parsePlecoXML } from "@/lib/parsePlecoXML";

test("parsePlecoXML parses a single card correctly", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plecoflash formatversion="2">
  <cards>
    <card language="chinese">
      <entry>
        <headword charset="sc">方便面</headword>
        <headword charset="tc">方便麵</headword>
        <pron type="hypy" tones="numbers">fang1bian4mian4</pron>
        <defn>noun instant noodles</defn>
      </entry>
    </card>
  </cards>
</plecoflash>`;

  const result = parsePlecoXML(xml);
  
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    chinese: "方便面",
    pinyin: "fāng biàn miàn",
    english: "noun instant noodles",
  });
});

test("parsePlecoXML parses multiple cards correctly", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plecoflash formatversion="2">
  <cards>
    <card language="chinese">
      <entry>
        <headword charset="sc">方便</headword>
        <pron type="hypy" tones="numbers">fang1bian4</pron>
        <defn>verb make things convenient</defn>
      </entry>
    </card>
    <card language="chinese">
      <entry>
        <headword charset="sc">医生</headword>
        <pron type="hypy" tones="numbers">yi1sheng1</pron>
        <defn>noun doctor; medical man</defn>
      </entry>
    </card>
    <card language="chinese">
      <entry>
        <headword charset="sc">城市</headword>
        <pron type="hypy" tones="numbers">cheng2shi4</pron>
        <defn>noun town; city</defn>
      </entry>
    </card>
  </cards>
</plecoflash>`;

  const result = parsePlecoXML(xml);
  
  expect(result).toHaveLength(3);
  expect(result[0]).toEqual({
    chinese: "方便",
    pinyin: "fāng biàn",
    english: "verb make things convenient",
  });
  expect(result[1]).toEqual({
    chinese: "医生",
    pinyin: "yī shēng",
    english: "noun doctor; medical man",
  });
  expect(result[2]).toEqual({
    chinese: "城市",
    pinyin: "chéng shì",
    english: "noun town; city",
  });
});

test("parsePlecoXML handles empty XML", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plecoflash formatversion="2">
  <cards></cards>
</plecoflash>`;

  const result = parsePlecoXML(xml);
  
  expect(result).toHaveLength(0);
});

test("parsePlecoXML ignores cards without Chinese headword", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plecoflash formatversion="2">
  <cards>
    <card language="chinese">
      <entry>
        <pron type="hypy" tones="numbers">fang1bian4</pron>
      </entry>
    </card>
  </cards>
</plecoflash>`;

  const result = parsePlecoXML(xml);
  
  expect(result).toHaveLength(0);
});

test("parsePlecoXML ignores cards without pinyin", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plecoflash formatversion="2">
  <cards>
    <card language="chinese">
      <entry>
        <headword charset="sc">方便</headword>
        <defn>verb make things convenient</defn>
      </entry>
    </card>
  </cards>
</plecoflash>`;

  const result = parsePlecoXML(xml);
  
  expect(result).toHaveLength(0);
});

test("parsePlecoXML uses pinyin as fallback when English definition is missing", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plecoflash formatversion="2">
  <cards>
    <card language="chinese">
      <entry>
        <headword charset="sc">测试</headword>
        <pron type="hypy" tones="numbers">ce4shi4</pron>
      </entry>
    </card>
  </cards>
</plecoflash>`;

  const result = parsePlecoXML(xml);
  
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    chinese: "测试",
    pinyin: "cè shì",
    english: "cè shì", // Falls back to pinyin when no English definition
  });
});

test("parsePlecoXML handles real-world XML format", () => {
  // Using the actual format from the provided flash.xml file
  const xml = `<?xml version="1.0" encoding="UTF-8"?><plecoflash formatversion="2" creator="Pleco User 19127005" generator="Pleco 2.0 Flashcard Exporter" platform="iPhone OS" created="1762633995"><categories></categories><cards><card language="chinese" created="1760826850" modified="1760826850"><entry><headword charset="sc">方便面</headword><headword charset="tc">方便麵</headword><pron type="hypy" tones="numbers">fang1bian4mian4</pron><defn>noun instant noodles</defn></entry><dictref dictid="PACE" entryid="20775936"/></card><card language="chinese" created="1760826860" modified="1760826860"><entry><headword charset="sc">方便</headword><headword charset="tc">方便</headword><pron type="hypy" tones="numbers">fang1bian4</pron><defn>verb 1 make things convenient for sb. 2 euphemistic have money to spare or lend 3 euphemistic go to the lavatory 
noun convenience; favour</defn></entry><dictref dictid="PACE" entryid="20775680"/></card></cards></plecoflash>`;

  const result = parsePlecoXML(xml);
  
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({
    chinese: "方便面",
    pinyin: "fāng biàn miàn",
    english: "noun instant noodles",
  });
  expect(result[1]).toEqual({
    chinese: "方便",
    pinyin: "fāng biàn",
    english: "verb 1 make things convenient for sb. 2 euphemistic have money to spare or lend 3 euphemistic go to the lavatory \nnoun convenience; favour",
  });
});

test("parsePlecoXML handles different tone numbers correctly", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plecoflash formatversion="2">
  <cards>
    <card language="chinese">
      <entry>
        <headword charset="sc">家</headword>
        <pron type="hypy" tones="numbers">jia1</pron>
        <defn>noun family; household</defn>
      </entry>
    </card>
    <card language="chinese">
      <entry>
        <headword charset="sc">工程师</headword>
        <pron type="hypy" tones="numbers">gong1cheng2shi1</pron>
        <defn>engineer</defn>
      </entry>
    </card>
  </cards>
</plecoflash>`;

  const result = parsePlecoXML(xml);
  
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({
    chinese: "家",
    pinyin: "jiā",
    english: "noun family; household",
  });
  expect(result[1]).toEqual({
    chinese: "工程师",
    pinyin: "gōng chéng shī",
    english: "engineer",
  });
});

