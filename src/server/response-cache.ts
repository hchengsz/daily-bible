import { createHash } from "node:crypto";

// Only the server imports this module. The private bucket contains AI results,
// never credentials or user reading progress.
export function withResponseCache(name: string, handler: (request: Request) => Promise<Response>) {
  const pending = new Map<string, Promise<Response>>();
  return async (request: Request): Promise<Response> => {
    const origin = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!origin || !key) return handler(request);
    const raw = await request.clone().text();
    if (raw.length > 200000) return Response.json({ error: "Request too large." }, { status: 413 });
    const model = name === "translate"
      ? `${process.env.GOOGLE_TRANSLATE_BASE_URL || "google"}:${process.env.GOOGLE_TRANSLATE_TARGET_LANGUAGE || "zh-CN"}`
      : (name === "ai-translate" ? process.env.GEMINI_TRANSLATE_MODEL : undefined) || process.env.GEMINI_VOCAB_MODEL || "gemini-3.5-flash";
    const hash = createHash("sha256").update(`v1:${name}:${model}:${raw}`).digest("hex");
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "daily-bible-cache";
    const url = `${origin.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${name}/${hash}.json`;
    const headers = { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }) };
    const existing = pending.get(hash);
    if (existing) return (await existing).clone();
    const operation = (async () => {
      try {
        const cached = await fetch(url, { headers, signal: AbortSignal.timeout(5000), redirect: "error" });
        if (cached.ok) return Response.json(await cached.json());
      } catch { /* Cache failure must not prevent a reading. */ }
      const response = await handler(request);
      if (response.ok) {
        try {
          await fetch(url, {
            method: "POST", headers: { ...headers, "Content-Type": "application/json", "x-upsert": "true" },
            body: await response.clone().text(), signal: AbortSignal.timeout(5000), redirect: "error",
          });
        } catch { /* Return the generated result even if storage is unavailable. */ }
      }
      return response;
    })();
    pending.set(hash, operation);
    try { return (await operation).clone(); } finally { pending.delete(hash); }
  };
}
