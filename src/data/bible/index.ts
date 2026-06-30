import acts from "./Acts.json";
import amos from "./Amos.json";
import firstChronicles from "./1 Chronicles.json";
import firstCorinthians from "./1 Corinthians.json";
import firstJohn from "./1 John.json";
import firstKings from "./1 Kings.json";
import firstPeter from "./1 Peter.json";
import firstSamuel from "./1 Samuel.json";
import firstThessalonians from "./1 Thessalonians.json";
import firstTimothy from "./1 Timothy.json";
import secondChronicles from "./2 Chronicles.json";
import secondCorinthians from "./2 Corinthians.json";
import secondJohn from "./2 John.json";
import secondKings from "./2 Kings.json";
import secondPeter from "./2 Peter.json";
import secondSamuel from "./2 Samuel.json";
import secondThessalonians from "./2 Thessalonians.json";
import secondTimothy from "./2 Timothy.json";
import thirdJohn from "./3 John.json";
import colossians from "./Colossians.json";
import daniel from "./Daniel.json";
import deuteronomy from "./Deuteronomy.json";
import ecclesiastes from "./Ecclesiastes.json";
import ephesians from "./Ephesians.json";
import esther from "./Esther.json";
import exodus from "./Exodus.json";
import ezekiel from "./Ezekiel.json";
import ezra from "./Ezra.json";
import galatians from "./Galatians.json";
import genesis from "./Genesis.json";
import habakkuk from "./Habakkuk.json";
import haggai from "./Haggai.json";
import hebrews from "./Hebrews.json";
import hosea from "./Hosea.json";
import isaiah from "./Isaiah.json";
import james from "./James.json";
import jeremiah from "./Jeremiah.json";
import job from "./Job.json";
import joel from "./Joel.json";
import john from "./John.json";
import jonah from "./Jonah.json";
import joshua from "./Joshua.json";
import jude from "./Jude.json";
import judges from "./Judges.json";
import lamentations from "./Lamentations.json";
import leviticus from "./Leviticus.json";
import luke from "./Luke.json";
import malachi from "./Malachi.json";
import mark from "./Mark.json";
import matthew from "./Matthew.json";
import micah from "./Micah.json";
import nahum from "./Nahum.json";
import nehemiah from "./Nehemiah.json";
import numbers from "./Numbers.json";
import obadiah from "./Obadiah.json";
import philemon from "./Philemon.json";
import philippians from "./Philippians.json";
import proverbs from "./Proverbs.json";
import psalms from "./Psalms.json";
import revelation from "./Revelation.json";
import romans from "./Romans.json";
import ruth from "./Ruth.json";
import songOfSongs from "./Song of Songs.json";
import titus from "./Titus.json";
import zechariah from "./Zechariah.json";
import zephaniah from "./Zephaniah.json";

import type { BibleBook, BibleChapter } from "./types";

export type { BibleBook, BibleChapter, BibleVerse } from "./types";

type VersePart = "a" | "b";

type VerseToken = {
  chapter?: number;
  verse: number;
  part?: VersePart;
};

const bibleBooks = [
  genesis,
  exodus,
  leviticus,
  numbers,
  deuteronomy,
  joshua,
  judges,
  ruth,
  firstSamuel,
  secondSamuel,
  firstKings,
  secondKings,
  firstChronicles,
  secondChronicles,
  ezra,
  nehemiah,
  esther,
  job,
  psalms,
  proverbs,
  ecclesiastes,
  songOfSongs,
  isaiah,
  jeremiah,
  lamentations,
  ezekiel,
  daniel,
  hosea,
  joel,
  amos,
  obadiah,
  jonah,
  micah,
  nahum,
  habakkuk,
  zephaniah,
  haggai,
  zechariah,
  malachi,
  matthew,
  mark,
  luke,
  john,
  acts,
  romans,
  firstCorinthians,
  secondCorinthians,
  galatians,
  ephesians,
  philippians,
  colossians,
  firstThessalonians,
  secondThessalonians,
  firstTimothy,
  secondTimothy,
  titus,
  philemon,
  hebrews,
  james,
  firstPeter,
  secondPeter,
  firstJohn,
  secondJohn,
  thirdJohn,
  jude,
  revelation,
] as BibleBook[];

const normalizeBookName = (bookName: string) =>
  bookName.trim().replace(/\s+/g, " ").toLowerCase();

const aliases: Record<string, string> = {
  psalm: "psalms",
  "song of solomon": "song of songs",
  "song of solomons": "song of songs",
  "songs of solomon": "song of songs",
};

const FIRST_SENTENCE_PATTERN = /[.!?][”"’'`)\]]*/;

const joinScriptureTexts = (texts: string[]) =>
  texts
    .map((text) => text.trim())
    .filter(Boolean)
    .join(" ");

const bibleByBookName = new Map<string, BibleBook>();

for (const book of bibleBooks) {
  bibleByBookName.set(normalizeBookName(book.book), book);
}

for (const [alias, canonical] of Object.entries(aliases)) {
  const canonicalBook = bibleByBookName.get(canonical);

  if (canonicalBook) {
    bibleByBookName.set(alias, canonicalBook);
  }
}

export const getBibleBook = (bookName: string): BibleBook | null => {
  const normalizedName = normalizeBookName(bookName);
  const book = bibleByBookName.get(normalizedName);

  if (!book) {
    console.warn(`Book not found: ${bookName}`);
    return null;
  }

  return book;
};

const getBibleChapter = (
  book: BibleBook,
  chapter: number,
): BibleChapter | null => {
  const chapterData = book.chapters.find(
    (item) => Number(item.chapter) === chapter,
  );

  if (!chapterData) {
    console.warn(`Chapter not found: ${book.book} ${chapter}`);
    return null;
  }

  return chapterData;
};

export function getVerse(
  bookName: string,
  chapter: number,
  verse: number,
): string | null {
  const book = getBibleBook(bookName);

  if (!book) {
    return null;
  }

  const chapterData = getBibleChapter(book, chapter);

  if (!chapterData) {
    return null;
  }

  return (
    chapterData.verses.find((item) => Number(item.verse) === verse)?.text ?? null
  );
}

const parseVerseToken = (value: string): VerseToken | null => {
  const match = value.trim().match(/^(?:(\d+)\s*:\s*)?(\d+)([ab])?$/i);

  if (!match) {
    return null;
  }

  return {
    chapter: match[1] ? Number(match[1]) : undefined,
    verse: Number(match[2]),
    part: match[3]?.toLowerCase() as VersePart | undefined,
  };
};

const splitVerseParts = (text: string) => {
  const match = FIRST_SENTENCE_PATTERN.exec(text);

  if (!match) {
    return { first: text, rest: "" };
  }

  const firstSentenceEnd = match.index + match[0].length;

  return {
    first: text.slice(0, firstSentenceEnd),
    rest: text.slice(firstSentenceEnd).trimStart(),
  };
};

const getSingleVerseText = (
  bookName: string,
  chapter: number,
  token: VerseToken,
): string => {
  const text = getVerse(bookName, chapter, token.verse) ?? "";

  if (!token.part) {
    return text;
  }

  const { first, rest } = splitVerseParts(text);

  return token.part === "a" ? first : rest;
};

const getRangeStartText = (
  bookName: string,
  chapter: number,
  token: VerseToken,
): string => {
  if (token.part !== "b") {
    return getVerse(bookName, chapter, token.verse) ?? "";
  }

  return getSingleVerseText(bookName, chapter, token);
};

const getRangeEndText = (
  bookName: string,
  chapter: number,
  token: VerseToken,
): string => {
  if (token.part !== "a") {
    return getVerse(bookName, chapter, token.verse) ?? "";
  }

  return getSingleVerseText(bookName, chapter, token);
};

const getSameVerseRangeText = (
  bookName: string,
  chapter: number,
  start: VerseToken,
  end: VerseToken,
): string => {
  const text = getVerse(bookName, chapter, start.verse) ?? "";
  const startPartIndex = start.part === "b" ? 1 : 0;
  const endPartIndex = end.part === "a" ? 0 : 1;

  if (startPartIndex > endPartIndex) {
    return "";
  }

  if (startPartIndex === 0 && endPartIndex === 1) {
    return text;
  }

  const { first, rest } = splitVerseParts(text);

  return startPartIndex === 0 ? first : rest;
};

const getChapterVerseRangeTexts = (
  bookName: string,
  chapter: number,
  startVerse: number,
  endVerse?: number,
): string[] => {
  const book = getBibleBook(bookName);

  if (!book) {
    return [];
  }

  const chapterData = getBibleChapter(book, chapter);

  if (!chapterData) {
    return [];
  }

  return chapterData.verses
    .filter((item) => {
      const verseNumber = Number(item.verse);

      return (
        verseNumber >= startVerse &&
        (endVerse === undefined || verseNumber <= endVerse)
      );
    })
    .map((item) => item.text);
};

export function getScriptureText(
  bookName: string,
  chapter: number,
  verseReference: string,
): string {
  const [startRaw, endRaw] = verseReference.split("-");
  const start = parseVerseToken(startRaw ?? "");

  if (!start) {
    return "";
  }

  const startChapter = start.chapter ?? chapter;

  if (!endRaw) {
    return getSingleVerseText(bookName, startChapter, start);
  }

  const end = parseVerseToken(endRaw);
  const endChapter = end?.chapter ?? startChapter;

  if (
    !end ||
    startChapter > endChapter ||
    (startChapter === endChapter && start.verse > end.verse)
  ) {
    return "";
  }

  if (startChapter === endChapter) {
    if (start.verse === end.verse) {
      return getSameVerseRangeText(bookName, startChapter, start, end);
    }

    const pieces = [getRangeStartText(bookName, startChapter, start)];

    for (let verse = start.verse + 1; verse < end.verse; verse += 1) {
      pieces.push(getVerse(bookName, startChapter, verse) ?? "");
    }

    pieces.push(getRangeEndText(bookName, startChapter, end));

    return joinScriptureTexts(pieces);
  }

  const pieces = [
    getRangeStartText(bookName, startChapter, start),
    ...getChapterVerseRangeTexts(bookName, startChapter, start.verse + 1),
  ];

  for (
    let chapterNumber = startChapter + 1;
    chapterNumber < endChapter;
    chapterNumber += 1
  ) {
    pieces.push(...getChapterVerseRangeTexts(bookName, chapterNumber, 1));
  }

  pieces.push(
    ...getChapterVerseRangeTexts(bookName, endChapter, 1, end.verse - 1),
    getRangeEndText(bookName, endChapter, end),
  );

  return joinScriptureTexts(pieces);
}

export function getVerseRange(
  bookName: string,
  chapter: number,
  startVerse: number,
  endVerse: number,
): string[] {
  const book = getBibleBook(bookName);

  if (!book) {
    return [];
  }

  const chapterData = getBibleChapter(book, chapter);

  if (!chapterData) {
    return [];
  }

  return chapterData.verses
    .filter((item) => {
      const verseNumber = Number(item.verse);

      return verseNumber >= startVerse && verseNumber <= endVerse;
    })
    .map((item) => item.text);
}
