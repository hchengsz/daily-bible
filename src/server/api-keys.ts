export function getRequestApiKey(request: Request) {
  // A supplied key must never fall back to the shared server credential.
  return request.headers.has("X-Gemini-Api-Key")
    ? request.headers.get("X-Gemini-Api-Key")!.trim()
    : process.env.GEMINI_API_KEY;
}
