import chineseData from "../data/bible/zh_cuv.json";

export function getVerse(bookName: string, chapter: number, verse: number) {
  const book = chineseData.find((b) => b.name === bookName);

  if (!book) return null;

  return book.chapters[chapter - 1]?.[verse - 1];
}

export function getVerseRange(
  bookName: string,
  chapter: number,
  startVerse: number,
  endVerse: number,
) {
  const book = chineseData.find((b) => b.name === bookName);

  if (!book) return [];

  const verses = book.chapters[chapter - 1];

  return verses.slice(startVerse - 1, endVerse);
}
