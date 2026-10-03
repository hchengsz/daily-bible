import { create } from "zustand";
import { progressStorage } from "../progress/progress-storage";

export type Tradition = "catholic" | "protestant";
const STORAGE_KEY = "faith-tradition";
export const useTraditionStore = create<{
  tradition: Tradition | null;
  hydrated: boolean;
  error: string | null;
}>(() => ({ tradition: null, hydrated: false, error: null }));
let loading: Promise<void> | undefined;

export function loadTradition() {
  if (useTraditionStore.getState().hydrated) return Promise.resolve();
  if (!loading) loading = (async () => {
    try {
      const raw = await progressStorage.getItem(STORAGE_KEY);
      const value = raw ? JSON.parse(raw) : null;
      const tradition = value === "catholic" || value === "protestant" ? value : null;
      useTraditionStore.setState({ tradition, hydrated: true, error: null });
    } catch {
      useTraditionStore.setState({ error: "无法读取设置，请重试。" });
    }
  })().finally(() => { loading = undefined; });
  return loading;
}

export async function saveTradition(tradition: Tradition) {
  await progressStorage.setItem(STORAGE_KEY, JSON.stringify(tradition));
  useTraditionStore.setState({ tradition, hydrated: true, error: null });
}
