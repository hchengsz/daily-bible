import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAppearanceStore } from '@/src/features/settings/appearance-store';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
const subscribe = () => () => {};

export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const appearanceHasHydrated = useAppearanceStore((state) => state.hasHydrated);
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);

  const colorScheme = useRNColorScheme();

  if (hasHydrated && appearanceHasHydrated) {
    return darkModeEnabled ? 'dark' : 'light';
  }

  return colorScheme === 'dark' ? 'dark' : 'light';
}
