export type ParsedReference = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

const extractNumber = (str: string) => {
  return Number(str.replace(/[^\d]/g, ""));
};

/**
 * 支持：
 * - 1-10
 * - 21a
 * - 20b-21
 * - 10-2:1 (跨章)
 */
export const parseVerseRange = (
  book: string,
  chapter: number,
  verse: string,
): ParsedReference => {
  // CASE 1: range
  if (verse.includes("-")) {
    const [startRaw, endRaw] = verse.split("-");

    return {
      book,
      chapter,
      startVerse: extractNumber(startRaw),
      endVerse: extractEndVerse(endRaw, chapter),
    };
  }

  // CASE 2: single verse (21a / 21)
  const v = extractNumber(verse);

  return {
    book,
    chapter,
    startVerse: v,
    endVerse: v,
  };
};

/**
 * 处理 end verse（支持跨章：2:1）
 */
const extractEndVerse = (endRaw: string, startChapter: number): number => {
  // case: 2:1
  if (endRaw.includes(":")) {
    const [ch, v] = endRaw.split(":").map((x) => extractNumber(x));

    // ⚠️ 跨章简化策略：直接映射为连续编号（用于 UI/TTS）
    // 如果你未来要严格圣经结构，可以再升级
    return v + (ch - startChapter) * 1000;
  }

  return extractNumber(endRaw);
};
