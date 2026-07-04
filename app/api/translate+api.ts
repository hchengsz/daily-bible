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

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "string"
          ? error.cause
          : "";

    return [error.message, cause].filter(Boolean).join(": ");
  }

  return String(error);
};

const normalizeTargetLanguage = (targetLanguage?: string) => {
  const normalized = targetLanguage?.trim().toLowerCase();

  if (!normalized || normalized === "simplified chinese") {
    return DEFAULT_TARGET_LANGUAGE;
  }

  return targetLanguage?.trim() || DEFAULT_TARGET_LANGUAGE;
};

const translateGoogleError = (payload: GoogleTranslatePayload | null) => {
  const message = payload?.error?.message;

  if (!message) {
    return "Google Translate request failed.";
  }

  if (
    message.includes("API key not valid") ||
    message.includes("API_KEY_INVALID")
  ) {
    return "Google Translate API key is invalid. Check GOOGLE_TRANSLATE_API_KEY.";
  }

  if (
    message.includes("has not been used") ||
    message.includes("is disabled") ||
    message.includes("SERVICE_DISABLED")
  ) {
    return "Google Cloud Translation API is not enabled. Enable Cloud Translation API for this project in Google Cloud Console.";
  }

  if (
    message.toLowerCase().includes("billing") ||
    message.includes("BILLING_DISABLED")
  ) {
    return "Billing is not enabled for this Google Cloud project. Cloud Translation API requires billing to be enabled.";
  }

  return message;
};

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GOOGLE_TRANSLATE_API_KEY is not configured." },
      { status: 500 },
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
    url.searchParams.set("key", apiKey);

    googleResponse = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: chunks.map((chunk) => chunk.text),
        target: targetLanguage,
        format: "text",
      }),
    });
  } catch (error) {
    return Response.json(
      {
        error: `Expo server could not connect to Google Translate API. If your VPN uses a local or browser proxy, stop the current Expo server and start it with npm run start:proxy. ${getErrorMessage(
          error,
        )}`,
      },
      { status: 502 },
    );
  }

  const payload = await readJsonResponse<GoogleTranslatePayload>(googleResponse);

  if (!googleResponse.ok) {
    return Response.json(
      { error: translateGoogleError(payload) },
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
