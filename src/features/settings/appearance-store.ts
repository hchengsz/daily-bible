import { create } from "zustand";
import { progressStorage } from "../progress/progress-storage";

type AppearanceState = {
  darkModeEnabled: boolean;
  hasHydrated: boolean;
  setDarkModeEnabled: (enabled: boolean) => void;
};

const STORAGE_KEY = "appearance-settings";

const saveAppearance = (darkModeEnabled: boolean) => {
  Promise.resolve(
    progressStorage.setItem(STORAGE_KEY, JSON.stringify({ darkModeEnabled })),
  ).catch(() => undefined);
};

export const useAppearanceStore = create<AppearanceState>((set) => ({
  darkModeEnabled: false,
  hasHydrated: false,
  setDarkModeEnabled: (darkModeEnabled) => {
    saveAppearance(darkModeEnabled);
    set({ darkModeEnabled });
  },
}));

Promise.resolve(progressStorage.getItem(STORAGE_KEY))
  .then((value) => {
    if (!value) {
      useAppearanceStore.setState({ hasHydrated: true });
      return;
    }

    const parsed = JSON.parse(value) as {
      darkModeEnabled?: boolean;
    };

    useAppearanceStore.setState({
      darkModeEnabled: Boolean(parsed.darkModeEnabled),
      hasHydrated: true,
    });
  })
  .catch(() => {
    useAppearanceStore.setState({ hasHydrated: true });
  });
