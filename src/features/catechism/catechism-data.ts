import { getDayOfYear } from "../reading/reading-plan-utils";

export type CatechismItem = {
  answer: string;
  question: string;
  references: string[];
};

export const catechismItems: CatechismItem[] = [
  {
    answer:
      "God, infinitely perfect and blessed in himself, freely created man to make him share in his own blessed life. In the fullness of time, the Father sent his Son as Redeemer and Savior, calling all people into his Church and making them adopted children through the Holy Spirit.",
    question: "What is the plan of God for man?",
    references: ["CCC 1-25"],
  },
  {
    answer:
      "God has written upon the human heart the desire to see him. Even when this desire is ignored, God continually draws man to himself, because only in God can man find the fullness of truth and happiness.",
    question: "Why does man have a desire for God?",
    references: ["CCC 27-30", "CCC 44-45"],
  },
  {
    answer:
      "Starting from creation, from the world and from the human person, human reason can know God with certainty as the origin and end of the universe, the highest good, and infinite truth and beauty.",
    question: "How is it possible to know God with only the light of human reason?",
    references: ["CCC 31-36", "CCC 46-47"],
  },
  {
    answer:
      "Reason alone encounters many difficulties in knowing the mystery of God. Man needs to be enlightened by God's revelation, both for truths beyond his understanding and for religious and moral truths that can otherwise be known with difficulty.",
    question: "Is the light of reason alone sufficient to know the mystery of God?",
    references: ["CCC 37-38"],
  },
  {
    answer:
      "We can speak about God by beginning from the perfections of creatures, especially the human person, which reflect God's infinite perfection in a limited way. Yet our language must be continually purified because it can never fully express the infinite mystery of God.",
    question: "How can we speak about God?",
    references: ["CCC 39-43", "CCC 48-49"],
  },
  {
    answer:
      "In his goodness and wisdom, God reveals himself and his loving plan decreed from all eternity in Christ. By the grace of the Holy Spirit, all people are called to share in divine life as adopted children in the only-begotten Son of God.",
    question: "What does God reveal to man?",
    references: ["CCC 50-53", "CCC 68-69"],
  },
];

export const getCatechismIndexForDate = (date: Date) =>
  (getDayOfYear(date) - 1) % catechismItems.length;

export const getCatechismItemForDate = (date: Date) =>
  catechismItems[getCatechismIndexForDate(date)];
