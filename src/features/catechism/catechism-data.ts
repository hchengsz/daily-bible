import { getDayOfYear } from "../reading/reading-plan-utils";

export type CatechismItem = {
  answer: string;
  question: string;
  references: string[];
};

export const catechismItems: CatechismItem[] = [
  {
    answer: "Man's chief end is to glorify God, and to enjoy him forever.",
    question: "What is the chief end of man?",
    references: ["1 Corinthians 10:31", "Psalm 73:25-26"],
  },
  {
    answer:
      "The Word of God, which is contained in the Scriptures of the Old and New Testaments, is the only rule to direct us how we may glorify and enjoy him.",
    question:
      "What rule has God given to direct us how we may glorify and enjoy him?",
    references: ["2 Timothy 3:16", "Ephesians 2:20"],
  },
  {
    answer:
      "The Scriptures principally teach what man is to believe concerning God, and what duty God requires of man.",
    question: "What do the Scriptures principally teach?",
    references: ["John 20:31", "Micah 6:8"],
  },
  {
    answer:
      "God is a Spirit, infinite, eternal, and unchangeable, in his being, wisdom, power, holiness, justice, goodness, and truth.",
    question: "What is God?",
    references: ["John 4:24", "Psalm 90:2"],
  },
  {
    answer: "There is but one only, the living and true God.",
    question: "Are there more Gods than one?",
    references: ["Deuteronomy 6:4", "Jeremiah 10:10"],
  },
  {
    answer:
      "There are three persons in the Godhead: the Father, the Son, and the Holy Ghost; and these three are one God, the same in substance, equal in power and glory.",
    question: "How many persons are there in the Godhead?",
    references: ["Matthew 28:19", "2 Corinthians 13:14"],
  },
];

export const getCatechismIndexForDate = (date: Date) =>
  (getDayOfYear(date) - 1) % catechismItems.length;

export const getCatechismItemForDate = (date: Date) =>
  catechismItems[getCatechismIndexForDate(date)];
