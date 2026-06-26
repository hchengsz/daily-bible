import day166 from "./day166.json";
import day167 from "./day167.json";
import day168 from "./day168.json";
import day169 from "./day169.json";
import day170 from "./day170.json";
import day171 from "./day171.json";
import day172 from "./day172.json";
import day173 from "./day173.json";
import day174 from "./day174.json";
import day175 from "./day175.json";
import day176 from "./day176.json";
import day177 from "./day177.json";
import day178 from "./day178.json";
import day179 from "./day179.json";
import day180 from "./day180.json";
import day181 from "./day181.json";
import day182 from "./day182.json";

const rawReadingDays = [
  day166,
  day167,
  day168,
  day169,
  day170,
  day171,
  day172,
  day173,
  day174,
  day175,
  day176,
  day177,
  day178,
  day179,
  day180,
  day181,
  day182,
] as unknown[];

export const readingPlanDays = rawReadingDays.flatMap((day) =>
  Array.isArray(day) ? day : [day],
);
