import source from "../../data/westminster-confession.json";
import { getCatechismDayNumberForDate } from "./catechism-data";

export const confessionSections = source.Data.flatMap(chapter => chapter.Sections.map(section => ({
  number: Number(section.Section),
  reference: `${chapter.Chapter}.${section.Section}`,
  title: chapter.Title,
  text: section.Content,
})));

// Read one section each day, cycling through all 172 sections before repeating.
// Use the same annual/leap-day convention as the existing catechism plan.
export function getConfessionDayForDate(date: Date) {
  const day = getCatechismDayNumberForDate(date);
  const entry = confessionSections[(day - 1) % confessionSections.length];
  return { day, entries: [entry], startNumber: entry.number, endNumber: entry.number, reference: entry.reference };
}
