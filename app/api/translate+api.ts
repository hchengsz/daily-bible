type TranslationChunk = {
  id: string;
  text: string;
};

type TranslationRequest = {
  targetLanguage?: string;
  chunks?: TranslationChunk[];
};

type ResponsesContent = {
  type?: string;
  text?: string;
};

type ResponsesOutput = {
  type?: string;
  content?: ResponsesContent[];
};

type ResponsesPayload = {
  error?: {
    message?: string;
  };
  output_text?: string;
  output?: ResponsesOutput[];
};

const OPENAI_BASE_URL = (
  process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
).replace(/\/$/, "");
const OPENAI_RESPONSES_URL = `${OPENAI_BASE_URL}/responses`;
const DEFAULT_TARGET_LANGUAGE = "Simplified Chinese";
const DEFAULT_MODEL = "gpt-5.4-mini";
const MAX_CHUNKS = 120;
const MAX_CHARACTERS = 50000;

const translationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          text: { type: "string" },
        },
        required: ["id", "text"],
      },
    },
  },
  required: ["translations"],
};

const readOutputText = (payload: ResponsesPayload) => {
  if (payload.output_text) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text ?? "")
      .join("") ?? ""
  );
};

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

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const body = await readRequestBody(request);
  const targetLanguage = body.targetLanguage?.trim() || DEFAULT_TARGET_LANGUAGE;
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

  let openaiResponse: Response;

  try {
    openaiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_MODEL,
        reasoning: { effort: "low" },
        instructions: [
          `Translate each chunk into ${targetLanguage}.`,
          "Preserve the meaning, paragraph breaks, punctuation, quotation marks, names, and Bible references.",
          "Return exactly one translation object for each input id. Do not add commentary.",
        ].join(" "),
        input: JSON.stringify({ targetLanguage, chunks }),
        text: {
          format: {
            type: "json_schema",
            name: "reading_translation",
            strict: true,
            schema: translationSchema,
          },
        },
      }),
    });
  } catch (error) {
    return Response.json(
      {
        error: `Unable to reach OpenAI API. Check your network, VPN/proxy, or OPENAI_BASE_URL. ${getErrorMessage(
          error,
        )}`,
      },
      { status: 502 },
    );
  }

  const payload = await readJsonResponse<ResponsesPayload>(openaiResponse);

  if (!openaiResponse.ok) {
    return Response.json(
      {
        error:
          payload?.error?.message ||
          `OpenAI request failed with status ${openaiResponse.status}.`,
      },
      { status: openaiResponse.status },
    );
  }

  if (!payload) {
    return Response.json(
      { error: "OpenAI returned a non-JSON response." },
      { status: 502 },
    );
  }

  const outputText = readOutputText(payload);

  try {
    const parsed = JSON.parse(outputText) as { translations?: TranslationChunk[] };

    return Response.json({
      translations: parsed.translations?.filter(isTranslationChunk) ?? [],
    });
  } catch {
    return Response.json(
      { error: "OpenAI returned an invalid translation payload." },
      { status: 502 },
    );
  }
}
