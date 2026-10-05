// Classify upstream failures without returning provider messages, which may
// contain credentials or project identifiers.
export function providerError(status: number, payload: unknown): string {
  const label = "Gemini";
  if (status >= 500) return `${label} is temporarily unavailable (${status}). Please try again later.`;
  const error = (payload as { error?: { message?: unknown; details?: unknown; errors?: unknown } } | null)?.error;
  const details = JSON.stringify(error ?? {}).toLowerCase();
  if (status === 429 || /userratelimitexceeded|ratelimitexceeded|dailylimitexceeded|quotaexceeded|resource_exhausted/.test(details)) {
    return `${label} rate limit or quota exceeded. Try again later or check your project's quota in Google Cloud.`;
  }
  if (/api_key_invalid|api key not valid|api_key_expired|api_key_not_found|reported as leaked/.test(details) || status === 401) {
    return `${label} API Key is invalid, expired, or disabled. Replace it in Settings.`;
  }
  if (/billing|billing_disabled/.test(details)) return `${label} billing is unavailable. Check your Google Cloud project's billing settings.`;
  if (/service_disabled|has not been used|is disabled/.test(details)) return "Enable the Generative Language API in the Google Cloud project that owns your key.";
  if (status === 403 || /api_key_service_blocked|api_key_http_referrer_blocked|api_key_ip_address_blocked/.test(details)) {
    return "Gemini access denied. Check your key's API permissions, application restrictions, and project access.";
  }
  if (status === 404) return "Gemini model or endpoint unavailable (404). Check the server's model configuration.";
  return `${label} request failed (${status}). Check the API key and request configuration.`;
}
