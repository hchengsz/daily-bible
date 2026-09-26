import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { progressStorage } from '../progress/progress-storage';
import type { BibleVersion } from './reading-plan-utils';

export const useBibleVersionStore = create<{
  version: BibleVersion;
  setVersion: (version: BibleVersion) => void;
}>()(persist((set) => ({
  version: 'niv',
  setVersion: (version) => set({ version }),
}), {
  name: 'bible-version',
  storage: createJSONStorage(() => progressStorage),
  partialize: ({ version }) => ({ version }),
  merge: (saved, current) => ({ ...current, version: (saved as { version?: unknown })?.version === 'cuv' ? 'cuv' : 'niv' }),
}));
