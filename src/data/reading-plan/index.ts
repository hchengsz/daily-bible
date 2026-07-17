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
import day183 from "./day183.json";
import day184 from "./day184.json";
import day185 from "./day185.json";
import day186 from "./day186.json";
import day187 from "./day187.json";
import day188 from "./day188.json";
import day189 from "./day189.json";
import day190 from "./day190.json";
import day191 from "./day191.json";
import day192 from "./day192.json";
import day193 from "./day193.json";
import day194 from "./day194.json";
import day195 from "./day195.json";
import day196 from "./day196.json";
import day197 from "./day197.json";
import day198 from "./day198.json";
import day199 from "./day199.json";
import day200 from "./day200.json";
import day201 from "./day201.json";
import day202 from "./day202.json";
import day203 from "./day203.json";
import day204 from "./day204.json";
import day205 from "./day205.json";
import day206 from "./day206.json";

const readingPlanModules = [
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
  day183,
  day184,
  day185,
  day186,
  day187,
  day188,
  day189,
  day190,
  day191,
  day192,
  day193,
  day194,
  day195,
  day196,
  day197,
  day198,
  day199,
  day200,
  day201,
  day202,
  day203,
  day204,
  day205,
  day206,
] as unknown[];

export const readingPlanDays = readingPlanModules.flatMap((day) =>
  Array.isArray(day) ? day : [day],
);
