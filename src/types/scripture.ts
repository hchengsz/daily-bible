import englishData from "../data/bible/en_kjv.json";
import chineseData from "../data/bible/zh_cuv.json";

export interface BibleBook {
  abbrev: string;
  name: string;
  chapters: string[][];
}

const bible = chineseData as BibleBook[];
const bible2 = englishData as BibleBook[];

export function getVerse(
  bookName: string,
  chapter: number,
  verse: number,
): string | null {
  const book = bible.find((b) => b.name === bookName);

  if (!book) {
    console.warn(`Book not found: ${bookName}`);
    return null;
  }

  const chapterData = book.chapters[chapter - 1];

  if (!chapterData) {
    console.warn(`Chapter not found: ${bookName} ${chapter}`);
    return null;
  }

  return chapterData[verse - 1] ?? null;
}

export function getVerseRange(
  bookName: string,
  chapter: number,
  startVerse: number,
  endVerse: number,
): string[] {
  const book = bible.find((b) => b.name === bookName);

  if (!book) {
    console.warn(`Book not found: ${bookName}`);
    return [];
  }

  const chapterData = book.chapters[chapter - 1];

  if (!chapterData) {
    console.warn(`Chapter not found: ${bookName} ${chapter}`);
    return [];
  }

  return chapterData.slice(startVerse - 1, endVerse);
}
