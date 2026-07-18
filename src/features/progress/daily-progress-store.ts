import { create } from "zustand";
import { progressStorage } from "./progress-storage";

export type DailyTask = "reading" | "catechism" | "vocabulary";

type DailyProgressState = {
  completions: Record<string, boolean>;
  completeTask: (dateKey: number, task: DailyTask) => void;
  hasHydrated: boolean;
};

const getCompletionKey = (dateKey: number, task: DailyTask) =>
  `${dateKey}:${task}`;

const STORAGE_KEY = "daily-progress";

const saveCompletions = (completions: Record<string, boolean>) => {
  Promise.resolve(
    progressStorage.setItem(STORAGE_KEY, JSON.stringify({ completions })),
  ).catch(() => undefined);
};

export const useDailyProgressStore = create<DailyProgressState>((set) => ({
  completions: {},
  completeTask: (dateKey, task) =>
    set((state) => {
      const completions = {
        ...state.completions,
        [getCompletionKey(dateKey, task)]: true,
      };

      saveCompletions(completions);

      return { completions };
    }),
  hasHydrated: false,
}));

Promise.resolve(progressStorage.getItem(STORAGE_KEY))
  .then((value) => {
    if (!value) {
      useDailyProgressStore.setState({ hasHydrated: true });
      return;
    }

    const parsed = JSON.parse(value) as {
      completions?: Record<string, boolean>;
    };

    useDailyProgressStore.setState({
      completions: parsed.completions ?? {},
      hasHydrated: true,
    });
  })
  .catch(() => {
    useDailyProgressStore.setState({ hasHydrated: true });
  });

export const useTaskCompletion = (dateKey: number, task: DailyTask) =>
  useDailyProgressStore((state) =>
    Boolean(state.completions[getCompletionKey(dateKey, task)]),
  );
