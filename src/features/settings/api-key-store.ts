import { create } from "zustand";
import { readApiKeys, writeApiKeys } from "./api-key-storage";

type ApiKeys = { gemini: string };
type State = ApiKeys & { hydrated: boolean; revision: number };
export const useApiKeyStore = create<State>(() => ({
  gemini: "", hydrated: false, revision: 0,
}));
let loading: Promise<void> | undefined;

export function loadApiKeys(): Promise<void> {
  if (useApiKeyStore.getState().hydrated) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const raw = await readApiKeys();
      const keys = raw ? JSON.parse(raw) : {};
      const gemini = typeof keys.gemini === "string" ? keys.gemini : "";
      useApiKeyStore.setState({ gemini, hydrated: true });
      if (raw && Object.prototype.hasOwnProperty.call(keys, "google")) {
        try { await writeApiKeys(gemini ? JSON.stringify({ gemini }) : null); } catch { /* Best-effort removal of the retired key. */ }
      }
    })().finally(() => { loading = undefined; });
  }
  return loading;
}

export async function saveApiKeys(draft: ApiKeys) {
  await loadApiKeys();
  const keys = { gemini: draft.gemini.trim() };
  // Gemini API keys can contain dots in addition to the characters used by
  // older Google API key formats. Keep rejecting whitespace and other
  // punctuation while accepting both formats.
  if (keys.gemini && !/^[A-Za-z0-9._-]{10,256}$/.test(keys.gemini)) {
    throw new Error("API Key format is invalid. Paste the full key without spaces.");
  }
  await writeApiKeys(keys.gemini ? JSON.stringify(keys) : null);
  useApiKeyStore.setState(state => ({ gemini: keys.gemini, revision: state.revision + 1 }));
}

export async function getApiKeyHeaders(): Promise<Record<string, string>> {
  try { await loadApiKeys(); } catch {
    throw new Error("Could not read your API key. Open Settings and try again.");
  }
  const keys = useApiKeyStore.getState();
  const key = keys.gemini;
  if (!key && process.env.EXPO_PUBLIC_AI_FEATURES_ENABLED === "false") {
    throw new Error("Add your Gemini API key in Settings first.");
  }
  return key ? { "X-Gemini-Api-Key": key } : {};
}
