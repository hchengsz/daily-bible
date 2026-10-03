import { create } from "zustand";
import { progressStorage } from "../progress/progress-storage";

type Chunk = { id: string; text: string };
type Entry = { source: string; scope: string; text: string };
const memory = new Map<string, Entry>();
const dirty = new Set<string>();
export const useTranslationCacheStatus = create<{ warning: string | null }>(() => ({ warning: null }));

// A compact filename; the full source and scope are also checked on every hit.
function keyFor(scope: string, source: string) {
  const value = JSON.stringify([scope, source]);
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `translation-v1-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}-${value.length}`;
}

async function persist(key: string, entry: Entry) {
  try {
    await progressStorage.setItem(key, JSON.stringify(entry));
    dirty.delete(key);
    if (!dirty.size) useTranslationCacheStatus.setState({ warning: null });
  } catch {
    dirty.add(key);
    useTranslationCacheStatus.setState({ warning: "译文已生成，但本地保存失败。请留在应用中，稍后再次打开译文以重试保存。" });
  }
}

async function read(scope: string, source: string) {
  const key = keyFor(scope, source);
  let entry: Entry | undefined = memory.get(key);
  if (!entry) {
    let raw: string | null;
    try { raw = await progressStorage.getItem(key); }
    catch { throw new Error("无法读取本地译文。请重试，以免重复消耗 AI 配额。"); }
    try { entry = raw ? JSON.parse(raw) : undefined; } catch { entry = undefined; }
  }
  if (!entry || entry.scope !== scope || entry.source !== source || typeof entry.text !== "string" || !entry.text.trim()) return undefined;
  memory.set(key, entry);
  if (dirty.has(key)) await persist(key, entry);
  return entry.text;
}

export async function translateWithLocalCache(
  scope: string,
  chunks: Chunk[],
  request: (missing: Chunk[]) => Promise<Record<string, string>>,
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: Chunk[] = [];
  for (const chunk of chunks) {
    signal?.throwIfAborted();
    const cached = await read(scope, chunk.text);
    if (cached !== undefined) result[chunk.id] = cached;
    else missing.push(chunk);
  }
  signal?.throwIfAborted();
  if (!missing.length) return result;
  // Identical source passages need only one upstream translation.
  const unique = [...new Map(missing.map(chunk => [chunk.text, chunk])).values()];
  const translated = await request(unique);
  if (unique.some(chunk => typeof translated[chunk.id] !== "string" || !translated[chunk.id].trim())) {
    throw new Error("AI 返回的译文不完整，请重试。");
  }
  const bySource = new Map<string, string>();
  for (const chunk of unique) {
    const text = translated[chunk.id];
    const entry = { scope, source: chunk.text, text };
    const key = keyFor(scope, chunk.text);
    memory.set(key, entry);
    await persist(key, entry);
    bySource.set(chunk.text, text);
  }
  // Save successful responses even if the reader navigated away during storage.
  signal?.throwIfAborted();
  for (const chunk of missing) result[chunk.id] = bySource.get(chunk.text)!;
  return result;
}
