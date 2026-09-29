export function getRequestApiKey(request: Request, provider: "ai" | "google") {
  const header = provider === "ai" ? "X-Gemini-Api-Key" : "X-Google-Translate-Api-Key";
  // A supplied key must never fall back to the shared server credential.
  return request.headers.has(header)
    ? request.headers.get(header)!.trim()
    : (provider === "ai" ? process.env.GEMINI_API_KEY : process.env.GOOGLE_TRANSLATE_API_KEY);
}
