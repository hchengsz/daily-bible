// Classify upstream failures without returning provider messages, which may
// contain credentials or project identifiers.
export function providerError(provider: "google" | "ai", status: number, payload: unknown): string {
  const label = provider === "google" ? "Google 翻译" : "Gemini";
  if (status >= 500) return `${label} 服务暂时不可用（${status}），请稍后重试。`;
  if (status === 429) return `${label} 请求过于频繁或配额已用尽（429），请稍后重试或检查该项目的配额。`;
  const error = (payload as { error?: { message?: unknown; details?: unknown; errors?: unknown } } | null)?.error;
  const details = JSON.stringify(error ?? {}).toLowerCase();
  if (/api_key_invalid|api key not valid|api_key_expired|api_key_not_found|reported as leaked/.test(details) || status === 401) {
    return `${label} API Key 无效、已过期或已被停用，请在 API 设置中更换密钥。`;
  }
  if (/billing|billing_disabled/.test(details)) return `${label} 所属项目未启用结算或结算不可用，请检查 Google Cloud 项目的结算设置。`;
  if (/service_disabled|has not been used|is disabled/.test(details)) {
    return provider === "google"
      ? "请在密钥所属的 Google Cloud 项目中启用 Cloud Translation API。"
      : "请在密钥所属的 Google Cloud 项目中启用 Generative Language API。";
  }
  if (status === 403 || /api_key_service_blocked|api_key_http_referrer_blocked|api_key_ip_address_blocked/.test(details)) {
    return provider === "google"
      ? "Google 翻译访问被拒绝，请检查 Cloud Translation API 权限及密钥的应用限制。AI Studio 的 Gemini 密钥默认仅支持 Gemini，请为普通翻译配置 Cloud Translation 密钥。"
      : "Gemini 访问被拒绝，请检查密钥的 API 权限、应用限制及项目访问权限。";
  }
  if (provider === "ai" && status === 404) return "Gemini 模型或接口不可用（404），需要检查服务器的模型配置。";
  return `${label} 请求失败（${status}），请检查对应服务的密钥和请求配置。`;
}
