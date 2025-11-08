// Convert pinyin with tone numbers to pinyin with tone marks
function convertPinyinTones(pinyin: string): string {
  // Map tone numbers to tone marks
  const toneMap: { [key: string]: string } = {
    'a1': 'ā', 'a2': 'á', 'a3': 'ǎ', 'a4': 'à', 'a5': 'a',
    'e1': 'ē', 'e2': 'é', 'e3': 'ě', 'e4': 'è', 'e5': 'e',
    'i1': 'ī', 'i2': 'í', 'i3': 'ǐ', 'i4': 'ì', 'i5': 'i',
    'o1': 'ō', 'o2': 'ó', 'o3': 'ǒ', 'o4': 'ò', 'o5': 'o',
    'u1': 'ū', 'u2': 'ú', 'u3': 'ǔ', 'u4': 'ù', 'u5': 'u',
    'ü1': 'ǖ', 'ü2': 'ǘ', 'ü3': 'ǚ', 'ü4': 'ǜ', 'ü5': 'ü',
  };

  // Split into syllables (each syllable ends with a tone number)
  const syllables = pinyin.match(/[a-zü]+[1-5]/gi) || [];
  
  const convertedSyllables = syllables.map(syllable => {
    let result = syllable.toLowerCase();
    const toneMatch = result.match(/([1-5])$/);
    if (!toneMatch) return result;
    
    const tone = toneMatch[1];
    const base = result.slice(0, -1); // Remove the tone number
    
    // Find the vowel to apply the tone mark to
    // Priority: a, e, o, then i/u (but iu -> i, ui -> u)
    
    if (base.includes('iu')) {
      // iu -> i gets the tone
      const iIndex = base.indexOf('i');
      const uIndex = base.indexOf('u', iIndex);
      if (iIndex !== -1 && uIndex !== -1 && uIndex === iIndex + 1) {
        result = base.slice(0, iIndex) + toneMap[`i${tone}`] + 'u' + base.slice(uIndex + 1);
      }
    } else if (base.includes('ui') && base.indexOf('u') < base.indexOf('i')) {
      // ui -> u gets the tone (only if u comes before i)
      const uIndex = base.indexOf('u');
      const iIndex = base.indexOf('i', uIndex);
      if (uIndex !== -1 && iIndex !== -1 && iIndex === uIndex + 1) {
        result = base.slice(0, uIndex) + toneMap[`u${tone}`] + 'i' + base.slice(iIndex + 1);
      }
    } else if (base.includes('a')) {
      // a gets the tone
      const aIndex = base.indexOf('a');
      result = base.slice(0, aIndex) + toneMap[`a${tone}`] + base.slice(aIndex + 1);
    } else if (base.includes('e')) {
      // e gets the tone
      const eIndex = base.indexOf('e');
      result = base.slice(0, eIndex) + toneMap[`e${tone}`] + base.slice(eIndex + 1);
    } else if (base.includes('o')) {
      // o gets the tone
      const oIndex = base.indexOf('o');
      result = base.slice(0, oIndex) + toneMap[`o${tone}`] + base.slice(oIndex + 1);
    } else if (base.includes('i')) {
      // i gets the tone
      const iIndex = base.indexOf('i');
      result = base.slice(0, iIndex) + toneMap[`i${tone}`] + base.slice(iIndex + 1);
    } else if (base.includes('u')) {
      // u gets the tone
      const uIndex = base.indexOf('u');
      result = base.slice(0, uIndex) + toneMap[`u${tone}`] + base.slice(uIndex + 1);
    } else if (base.includes('ü')) {
      // ü gets the tone
      const üIndex = base.indexOf('ü');
      result = base.slice(0, üIndex) + toneMap[`ü${tone}`] + base.slice(üIndex + 1);
    } else {
      // No vowel found, return as is
      result = base;
    }
    
    return result;
  });
  
  return convertedSyllables.join(' ');
}

export function parsePlecoXML(xmlContent: string): Array<{ chinese: string; pinyin: string; english: string }> {
  const words: Array<{ chinese: string; pinyin: string; english: string }> = [];
  
  // Extract all card elements
  const cardRegex = /<card[^>]*>([\s\S]*?)<\/card>/g;
  let cardMatch;
  
  while ((cardMatch = cardRegex.exec(xmlContent)) !== null) {
    const cardContent = cardMatch[1];
    
    // Extract simplified Chinese (charset="sc")
    const scMatch = cardContent.match(/<headword charset="sc">([^<]+)<\/headword>/);
    const chinese = scMatch ? scMatch[1].trim() : null;
    
    // Extract pinyin
    const pinyinMatch = cardContent.match(/<pron[^>]*tones="numbers">([^<]+)<\/pron>/);
    const pinyinNumbers = pinyinMatch ? pinyinMatch[1].trim() : null;
    
    // Extract English definition
    const defnMatch = cardContent.match(/<defn>([\s\S]*?)<\/defn>/);
    const english = defnMatch ? defnMatch[1].trim() : null;
    
    if (chinese && pinyinNumbers) {
      const pinyin = convertPinyinTones(pinyinNumbers);
      // Use English definition if available, otherwise fall back to pinyin
      words.push({ 
        chinese, 
        pinyin, 
        english: english || pinyin 
      });
    }
  }
  
  return words;
}

