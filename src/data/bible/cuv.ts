import data from './cuv.generated.json';

const books = data as Record<string, { name: string; chapters: Record<string, Record<string, string>> }>;
const names = new Map(Object.keys(books).map((name) => [name.toLowerCase(), name]));
const aliases: Record<string, string> = { psalm: 'psalms', 'song of solomon': 'song of songs', 'song of solomons': 'song of songs', 'songs of solomon': 'song of songs' };
const findBook = (name: string) => {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  return books[names.get(aliases[normalized] ?? normalized) ?? ''];
};

export const getCuvBookName = (name: string) => findBook(name)?.name ?? name;

/** NIV's a/b sentence boundaries are not portable: CUV displays whole verses. */
export function getCuvScriptureText(bookName: string, chapter: number, reference: string): string {
  const book = findBook(bookName);
  if (!book) return '';
  const normalized = reference.trim().replace(/[–—]/g, '-');
  if (!normalized) {
    const verses = book.chapters[chapter];
    return verses ? getCuvScriptureText(bookName, chapter, `1-${Math.max(...Object.keys(verses).map(Number))}`) : '';
  }
  if (/[,，]/.test(normalized)) {
    let currentChapter = chapter;
    const segments = normalized.split(/[,，]/).map((part) => {
      const result = getCuvScriptureText(bookName, currentChapter, part);
      const chapters = [...part.matchAll(/(\d+)\s*:/g)];
      if (chapters.length) currentChapter = Number(chapters[chapters.length - 1][1]);
      return result;
    });
    return segments.every(Boolean) ? segments.join(' ') : '';
  }
  const match = normalized.match(/^(?:(\d+):)?(\d+)[ab]?(?:\s*-\s*(?:(\d+):)?(\d+)[ab]?)?$/i);
  if (!book || !match) return '';
  const startChapter = Number(match[1] ?? chapter);
  const endChapter = Number(match[3] ?? startChapter);
  const startVerse = Number(match[2]);
  const endVerse = Number(match[4] ?? startVerse);
  if (startChapter > endChapter || (startChapter === endChapter && startVerse > endVerse)) return '';
  const result: string[] = [];
  for (let c = startChapter; c <= endChapter; c++) {
    const verses = book.chapters[c];
    if (!verses) return '';
    const first = c === startChapter ? startVerse : 1;
    const last = c === endChapter ? endVerse : Math.max(...Object.keys(verses).map(Number));
    for (let v = first; v <= last; v++) {
      if (verses[v] === undefined) return '';
      result.push(verses[v].trim() || `〔${book.name} ${c}:${v}：此节在本地和合本中未单独列文，可能与相邻经节合并。〕`);
    }
  }
  return result.join(' ');
}
