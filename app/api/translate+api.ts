import { withResponseCache } from "../../src/server/response-cache";
import { getRequestApiKey } from "../../src/server/api-keys";
import { providerError } from "../../src/server/provider-errors";

type TranslationChunk = {
  id: string;
  text: string;
};

type TranslationRequest = {
  targetLanguage?: string;
  chunks?: TranslationChunk[];
};

type GoogleTranslateItem = {
  translatedText: string;
  detectedSourceLanguage?: string;
};

type GoogleTranslatePayload = {
  data?: {
    translations?: GoogleTranslateItem[];
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const GOOGLE_TRANSLATE_URL = (
  process.env.GOOGLE_TRANSLATE_BASE_URL ??
  "https://translation.googleapis.com/language/translate/v2"
).replace(/\/$/, "");
const DEFAULT_TARGET_LANGUAGE =
  process.env.GOOGLE_TRANSLATE_TARGET_LANGUAGE || "zh-CN";
const MAX_CHUNKS = 120;
const MAX_CHARACTERS = 50000;

const isTranslationChunk = (value: unknown): value is TranslationChunk => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const chunk = value as TranslationChunk;

  return typeof chunk.id === "string" && typeof chunk.text === "string";
};

const readRequestBody = async (request: Request): Promise<TranslationRequest> => {
  try {
    return (await request.json()) as TranslationRequest;
  } catch {
    return {};
  }
};

const readJsonResponse = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const normalizeTargetLanguage = (targetLanguage?: string) => {
  const normalized = targetLanguage?.trim().toLowerCase();

  if (!normalized || normalized === "simplified chinese") {
    return DEFAULT_TARGET_LANGUAGE;
  }

  return targetLanguage?.trim() || DEFAULT_TARGET_LANGUAGE;
};

export const POST = withResponseCache("translate", handlePost);

async function handlePost(request: Request) {
  const apiKey = getRequestApiKey(request, "google");

  if (!apiKey) {
    return Response.json(
      { error: "请先到首页的 API 设置中填写 Google 翻译 API Key。" },
      { status: 503 },
    );
  }

  const body = await readRequestBody(request);
  const targetLanguage = normalizeTargetLanguage(body.targetLanguage);
  const chunks = body.chunks?.filter(isTranslationChunk) ?? [];
  const characterCount = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);

  if (!chunks.length) {
    return Response.json({ translations: [] });
  }

  if (chunks.length > MAX_CHUNKS || characterCount > MAX_CHARACTERS) {
    return Response.json(
      { error: "Translation request is too large." },
      { status: 413 },
    );
  }

  let googleResponse: Response;

  try {
    const url = new URL(GOOGLE_TRANSLATE_URL);

    googleResponse = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        q: chunks.map((chunk) => chunk.text),
        target: targetLanguage,
        format: "text",
      }),
    });
  } catch {
    return Response.json(
      {
        error: "无法连接翻译服务，请检查网络后重试。",
      },
      { status: 502 },
    );
  }

  const payload = await readJsonResponse<GoogleTranslatePayload>(googleResponse);

  if (!googleResponse.ok) {
    return Response.json(
      { error: providerError("google", googleResponse.status, payload) },
      { status: googleResponse.status },
    );
  }

  const translatedItems = payload?.data?.translations;

  if (!translatedItems) {
    return Response.json(
      { error: "Google Translate returned an invalid response." },
      { status: 502 },
    );
  }

  return Response.json({
    translations: chunks.map((chunk, index) => ({
      id: chunk.id,
      text: translatedItems[index]?.translatedText ?? chunk.text,
    })),
  });
}
