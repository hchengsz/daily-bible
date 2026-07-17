import { create } from "zustand";
import { progressStorage } from "../progress/progress-storage";

export const REQUIRED_CORRECT_STREAK = 7;

export type VocabularyNotebookStatus = "screening" | "learning";

export type VocabularyNotebookWord = {
  addedAt: string;
  correctStreak: number;
  definition: string;
  id: string;
  occurrences: number;
  sourceLabel?: string;
  status: VocabularyNotebookStatus;
  term: string;
  updatedAt: string;
};

type AddVocabularyWordInput = {
  definition: string;
  sourceLabel?: string;
  term: string;
};

type VocabularyNotebookState = {
  addWord: (word: AddVocabularyWordInput) => void;
  addWords: (words: AddVocabularyWordInput[]) => void;
  hasHydrated: boolean;
  keepForStudy: (id: string) => void;
  markCorrect: (id: string) => void;
  removeWord: (id: string) => void;
  resetStreak: (id: string) => void;
  words: VocabularyNotebookWord[];
};

const STORAGE_KEY = "vocabulary-notebook";

export const normalizeVocabularyTerm = (term: string) =>
  term.replace(/\s+/g, " ").trim();

export const getVocabularyWordId = (term: string) =>
  normalizeVocabularyTerm(term).toLowerCase();

const sanitizeWord = (word: unknown): VocabularyNotebookWord | null => {
  if (!word || typeof word !== "object") {
    return null;
  }

  const item = word as Partial<VocabularyNotebookWord>;
  const term =
    typeof item.term === "string" ? normalizeVocabularyTerm(item.term) : "";
  const definition =
    typeof item.definition === "string" ? item.definition.trim() : "";

  if (!term || !definition) {
    return null;
  }

  const now = new Date().toISOString();
  const id =
    typeof item.id === "string" && item.id.trim()
      ? item.id
      : getVocabularyWordId(term);
  const status: VocabularyNotebookStatus =
    item.status === "learning" ? "learning" : "screening";

  return {
    addedAt: typeof item.addedAt === "string" ? item.addedAt : now,
    correctStreak:
      typeof item.correctStreak === "number" && item.correctStreak > 0
        ? Math.floor(item.correctStreak)
        : 0,
    definition,
    id,
    occurrences:
      typeof item.occurrences === "number" && item.occurrences > 0
        ? Math.floor(item.occurrences)
        : 1,
    sourceLabel:
      typeof item.sourceLabel === "string" && item.sourceLabel.trim()
        ? item.sourceLabel.trim()
        : undefined,
    status,
    term,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
};

const saveWords = (words: VocabularyNotebookWord[]) => {
  Promise.resolve(
    progressStorage.setItem(STORAGE_KEY, JSON.stringify({ words })),
  ).catch(() => undefined);
};

const upsertWords = (
  currentWords: VocabularyNotebookWord[],
  incomingWords: AddVocabularyWordInput[],
) => {
  const nextWords = [...currentWords];
  let changed = false;

  for (const incomingWord of incomingWords) {
    const term = normalizeVocabularyTerm(incomingWord.term);
    const definition = incomingWord.definition.trim();

    if (!term || !definition) {
      continue;
    }

    const id = getVocabularyWordId(term);
    const existingIndex = nextWords.findIndex((word) => word.id === id);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const existing = nextWords[existingIndex];

      nextWords[existingIndex] = {
        ...existing,
        definition,
        occurrences: existing.occurrences + 1,
        sourceLabel: incomingWord.sourceLabel?.trim() || existing.sourceLabel,
        term,
        updatedAt: now,
      };
      changed = true;
      continue;
    }

    nextWords.unshift({
      addedAt: now,
      correctStreak: 0,
      definition,
      id,
      occurrences: 1,
      sourceLabel: incomingWord.sourceLabel?.trim() || undefined,
      status: "screening",
      term,
      updatedAt: now,
    });
    changed = true;
  }

  return changed ? nextWords : currentWords;
};

export const useVocabularyNotebookStore = create<VocabularyNotebookState>(
  (set) => ({
    addWord: (word) =>
      set((state) => {
        const words = upsertWords(state.words, [word]);

        if (words !== state.words) {
          saveWords(words);
        }

        return { words };
      }),
    addWords: (incomingWords) =>
      set((state) => {
        const words = upsertWords(state.words, incomingWords);

        if (words !== state.words) {
          saveWords(words);
        }

        return { words };
      }),
    hasHydrated: false,
    keepForStudy: (id) =>
      set((state) => {
        const words = state.words.map((word) =>
          word.id === id ? { ...word, status: "learning" as const } : word,
        );

        saveWords(words);

        return { words };
      }),
    markCorrect: (id) =>
      set((state) => {
        const words = state.words.flatMap((word) => {
          if (word.id !== id) {
            return [word];
          }

          const correctStreak = word.correctStreak + 1;

          if (correctStreak >= REQUIRED_CORRECT_STREAK) {
            return [];
          }

          return [{ ...word, correctStreak, status: "learning" as const }];
        });

        saveWords(words);

        return { words };
      }),
    removeWord: (id) =>
      set((state) => {
        const words = state.words.filter((word) => word.id !== id);

        saveWords(words);

        return { words };
      }),
    resetStreak: (id) =>
      set((state) => {
        const words = state.words.map((word) =>
          word.id === id ? { ...word, correctStreak: 0 } : word,
        );

        saveWords(words);

        return { words };
      }),
    words: [],
  }),
);

Promise.resolve(progressStorage.getItem(STORAGE_KEY))
  .then((value) => {
    if (!value) {
      useVocabularyNotebookStore.setState({ hasHydrated: true });
      return;
    }

    const parsed = JSON.parse(value) as { words?: unknown[] };
    const words = (Array.isArray(parsed.words) ? parsed.words : [])
      .map(sanitizeWord)
      .filter((word): word is VocabularyNotebookWord => word !== null);

    useVocabularyNotebookStore.setState({ hasHydrated: true, words });
  })
  .catch(() => {
    useVocabularyNotebookStore.setState({ hasHydrated: true });
  });
