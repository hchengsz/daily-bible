import catechismSource from "../../data/catechism-source/index.json";
import catechismReadingPlan from "../../data/catechism-source/reading-plan.json";
import {
  DAY_IN_MS,
  getDateKey,
} from "../reading/reading-plan-utils";

export type CatechismEntry = {
  number: number;
  text: string;
};

export type CatechismDay = {
  day: number;
  startNumber: number;
  endNumber: number;
  entryCount: number;
  characterCount: number;
  entries: CatechismEntry[];
};

type CatechismDaySource = Omit<CatechismDay, "entries">;

const catechismEntries =
  catechismSource.entries as unknown as CatechismEntry[];
const catechismDays = (
  catechismReadingPlan.days as CatechismDaySource[]
).map((day) => ({
  ...day,
  entries: catechismEntries.slice(day.startNumber - 1, day.endNumber),
}));

const isLeapYear = (year: number) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export const getCatechismDayNumberForDate = (date: Date) => {
  const year = date.getFullYear();
  const startOfYearKey = Date.UTC(year, 0, 1);
  let dayNumber =
    Math.floor((getDateKey(date) - startOfYearKey) / DAY_IN_MS) + 1;

  if (isLeapYear(year)) {
    if (date.getMonth() === 1 && date.getDate() === 29) {
      return 59;
    }

    if (date.getMonth() > 1) {
      dayNumber -= 1;
    }
  }

  return dayNumber;
};

export const getCatechismDayForDate = (date: Date) => {
  const dayNumber = getCatechismDayNumberForDate(date);

  return catechismDays[dayNumber - 1] ?? catechismDays[0];
};
