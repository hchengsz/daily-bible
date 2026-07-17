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

type KnownVocabularyWordIds = Record<string, boolean>;

type VocabularyNotebookState = {
  addWord: (word: AddVocabularyWordInput) => void;
  addWords: (words: AddVocabularyWordInput[]) => void;
  hasHydrated: boolean;
  keepForStudy: (id: string) => void;
  knownWordIds: KnownVocabularyWordIds;
  markCorrect: (id: string) => void;
  markKnown: (id: string) => void;
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

const saveNotebookState = (
  words: VocabularyNotebookWord[],
  knownWordIds: KnownVocabularyWordIds,
) => {
  Promise.resolve(
    progressStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ knownWordIds: Object.keys(knownWordIds), words }),
    ),
  ).catch(() => undefined);
};

const sanitizeKnownWordIds = (value: unknown) => {
  const ids =
    Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? Object.keys(value)
        : [];

  return ids.reduce<KnownVocabularyWordIds>((result, id) => {
    if (typeof id !== "string") {
      return result;
    }

    const normalizedId = getVocabularyWordId(id);

    if (normalizedId) {
      result[normalizedId] = true;
    }

    return result;
  }, {});
};

const dedupeWords = (
  words: VocabularyNotebookWord[],
  knownWordIds: KnownVocabularyWordIds,
) => {
  const wordsById = new Map<string, VocabularyNotebookWord>();

  for (const word of words) {
    const id = getVocabularyWordId(word.term);

    if (!id || knownWordIds[id] || wordsById.has(id)) {
      continue;
    }

    wordsById.set(id, { ...word, id });
  }

  return [...wordsById.values()];
};

const upsertWords = (
  currentWords: VocabularyNotebookWord[],
  incomingWords: AddVocabularyWordInput[],
  knownWordIds: KnownVocabularyWordIds,
) => {
  const nextWords = dedupeWords(currentWords, knownWordIds);
  let changed = nextWords.length !== currentWords.length;

  for (const incomingWord of incomingWords) {
    const term = normalizeVocabularyTerm(incomingWord.term);
    const definition = incomingWord.definition.trim();

    if (!term || !definition) {
      continue;
    }

    const id = getVocabularyWordId(term);

    if (knownWordIds[id]) {
      continue;
    }

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
        const words = upsertWords(state.words, [word], state.knownWordIds);

        if (words !== state.words) {
          saveNotebookState(words, state.knownWordIds);
        }

        return { words };
      }),
    addWords: (incomingWords) =>
      set((state) => {
        const words = upsertWords(
          state.words,
          incomingWords,
          state.knownWordIds,
        );

        if (words !== state.words) {
          saveNotebookState(words, state.knownWordIds);
        }

        return { words };
      }),
    hasHydrated: false,
    keepForStudy: (id) =>
      set((state) => {
        const words = state.words.map((word) =>
          word.id === id ? { ...word, status: "learning" as const } : word,
        );

        saveNotebookState(words, state.knownWordIds);

        return { words };
      }),
    knownWordIds: {},
    markCorrect: (id) =>
      set((state) => {
        let knownWordIds = state.knownWordIds;
        const words = state.words.flatMap((word) => {
          if (word.id !== id) {
            return [word];
          }

          const correctStreak = word.correctStreak + 1;

          if (correctStreak >= REQUIRED_CORRECT_STREAK) {
            knownWordIds = { ...knownWordIds, [id]: true };
            return [];
          }

          return [{ ...word, correctStreak, status: "learning" as const }];
        });

        saveNotebookState(words, knownWordIds);

        return { knownWordIds, words };
      }),
    markKnown: (id) =>
      set((state) => {
        const normalizedId = getVocabularyWordId(id);

        if (!normalizedId) {
          return {};
        }

        const words = state.words.filter((word) => word.id !== normalizedId);
        const knownWordIds = state.knownWordIds[normalizedId]
          ? state.knownWordIds
          : { ...state.knownWordIds, [normalizedId]: true };

        saveNotebookState(words, knownWordIds);

        return { knownWordIds, words };
      }),
    removeWord: (id) =>
      set((state) => {
        const words = state.words.filter((word) => word.id !== id);

        saveNotebookState(words, state.knownWordIds);

        return { words };
      }),
    resetStreak: (id) =>
      set((state) => {
        const words = state.words.map((word) =>
          word.id === id ? { ...word, correctStreak: 0 } : word,
        );

        saveNotebookState(words, state.knownWordIds);

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

    const parsed = JSON.parse(value) as {
      knownWordIds?: unknown;
      words?: unknown[];
    };
    const knownWordIds = sanitizeKnownWordIds(parsed.knownWordIds);
    const persistedWords = Array.isArray(parsed.words) ? parsed.words : [];
    const words = dedupeWords(
      persistedWords
        .map(sanitizeWord)
        .filter((word): word is VocabularyNotebookWord => word !== null),
      knownWordIds,
    );

    useVocabularyNotebookStore.setState({
      hasHydrated: true,
      knownWordIds,
      words,
    });
  })
  .catch(() => {
    useVocabularyNotebookStore.setState({ hasHydrated: true });
  });
