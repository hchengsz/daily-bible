import { readingPlanDays } from "../../data/reading-plan";
import { getScriptureText } from "../../data/bible";
import { getCuvBookName, getCuvScriptureText } from "../../data/bible/cuv";

export type BibleVersion = "niv" | "cuv";

export type Reference = {
  book: string;
  chapter: number;
  verse: string;
};

export type Paragraph = {
  title?: string;
  references?: Reference[];
  /** Inline scripture takes precedence over the NIV reference lookup. */
  text?: string;
  source?: {
    label: string;
    url: string;
  };
};

export type Section = {
  title?: string;
  introduction?: string;
  paragraphs?: Paragraph[];
};

export type Day = {
  id: number;
  title?: string;
  introduction?: string;
  sections?: Section[];
};

const DEFAULT_DAY: Day = { id: 0, sections: [] };
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

const readingDays = readingPlanDays as unknown as Day[];

export const getSections = (day?: Day | null) =>
  (Array.isArray(day?.sections) ? day.sections : []).filter(
    (section): section is Section => Boolean(section),
  );

export const getParagraphs = (section?: Section | null) =>
  (Array.isArray(section?.paragraphs) ? section.paragraphs : []).filter(
    (paragraph): paragraph is Paragraph => Boolean(paragraph),
  );

export const getReferences = (paragraph?: Paragraph | null) =>
  (Array.isArray(paragraph?.references) ? paragraph.references : []).filter(
    (reference): reference is Reference => Boolean(reference),
  );

export const getReferenceLabel = (ref: Reference) =>
  `${ref.book} ${ref.chapter}:${ref.verse}`;

export const getParagraphReferenceLabel = (paragraph: Paragraph, version: BibleVersion = "niv") =>
  getReferences(paragraph).map((ref) => version === "cuv"
    ? `${getCuvBookName(ref.book)} ${ref.chapter}${ref.verse ? `:${ref.verse.replace(/[ab]/gi, "")}` : "章"}`
    : getReferenceLabel(ref)).join("; ");

export const getParagraphScripture = (paragraph: Paragraph, version: BibleVersion = "niv") => {
  if (typeof paragraph.text === "string" && paragraph.text.trim()) {
    return paragraph.text.trim();
  }

  return getReferences(paragraph)
    .map(({ book, chapter, verse }) => version === "cuv"
      ? getCuvScriptureText(book, chapter, verse) || `〔${getCuvBookName(book)} ${chapter}:${verse}：本地和合本暂无对应经文。〕`
      : getScriptureText(book, chapter, verse))
    .map((text) => text.trim())
    .filter(Boolean)
    .join(" ");
};

export const getReadingReferenceSummary = (day: Day) =>
  getSections(day)
    .flatMap((section) =>
      getParagraphs(section).map((paragraph) => getParagraphReferenceLabel(paragraph)),
    )
    .filter(Boolean)
    .join("; ");

export const getDayOfYear = (date: Date) => {
  const startOfYear = Date.UTC(date.getFullYear(), 0, 1);
  const startOfDay = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  return Math.floor((startOfDay - startOfYear) / DAY_IN_MS) + 1;
};

export const getDateKey = (date: Date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

export const formatDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const getReadingDayForDate = (date: Date) => {
  const dayOfYear = getDayOfYear(date);

  return (
    readingDays.find((readingDay) => Number(readingDay.id) === dayOfYear) ??
    DEFAULT_DAY
  );
};

export const hasReadingDayForDate = (date: Date) => {
  const dayOfYear = getDayOfYear(date);

  return readingDays.some((readingDay) => Number(readingDay.id) === dayOfYear);
};
