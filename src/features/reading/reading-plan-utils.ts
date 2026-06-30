import { readingPlanDays } from "../../data/reading-plan";

export type Reference = {
  book: string;
  chapter: number;
  verse: string;
};

export type Paragraph = {
  title?: string;
  references?: Reference[];
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

export const getParagraphReferenceLabel = (paragraph: Paragraph) =>
  getReferences(paragraph).map(getReferenceLabel).join("; ");

export const getReadingReferenceSummary = (day: Day) =>
  getSections(day)
    .flatMap((section) => getParagraphs(section).map(getParagraphReferenceLabel))
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
