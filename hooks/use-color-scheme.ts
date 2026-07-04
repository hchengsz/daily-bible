import { useColorScheme as useRNColorScheme } from "react-native";
import { useAppearanceStore } from "@/src/features/settings/appearance-store";

export function useColorScheme() {
  const systemColorScheme = useRNColorScheme();
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
  const hasHydrated = useAppearanceStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return systemColorScheme;
  }

  return darkModeEnabled ? "dark" : "light";
}
