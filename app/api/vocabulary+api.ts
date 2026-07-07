import { ProxyAgent } from "undici";

type VocabularyChunk = {
  id: string;
  text: string;
};

type VocabularyItem = {
  definition: string;
  term: string;
};

type VocabularyResult = {
  id: string;
  terms: VocabularyItem[];
};

type VocabularyRequest = {
  chunks?: VocabularyChunk[];
};

type GeminiResponsePayload = {
  error?: {
    message?: string;
  };
  output_text?: string;
  steps?: {
    content?: {
      text?: string;
      type?: string;
    }[];
    type?: string;
  }[];
};

const GEMINI_INTERACTIONS_URL =
  process.env.GEMINI_API_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_VOCAB_MODEL =
  process.env.GEMINI_VOCAB_MODEL || "gemini-3.5-flash";
const GEMINI_PROXY_URL = normalizeProxyUrl(process.env.DEV_PROXY_URL);
const MAX_CHUNKS = 80;
const MAX_CHARACTERS = 45000;
const GEMINI_PROXY_AGENT = createProxyAgent(GEMINI_PROXY_URL);

type GeminiRequestInit = RequestInit & {
  dispatcher?: ProxyAgent;
};

function normalizeProxyUrl(proxyServer?: string) {
  if (!proxyServer) {
    return "";
  }

  let candidate = proxyServer.trim();

  if (!candidate) {
    return "";
  }

  if (candidate.includes(";")) {
    const parts = candidate.split(";").filter(Boolean);
    const httpsPart = parts.find((part) => part.startsWith("https="));
    const httpPart = parts.find((part) => part.startsWith("http="));

    candidate = httpsPart || httpPart || parts[0] || "";
    candidate = candidate.replace(/^(https?|socks)=/, "");
  }

  if (!candidate) {
    return "";
  }

  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)
    ? candidate
    : `http://${candidate}`;
}

function createProxyAgent(proxyUrl: string) {
  if (!proxyUrl) {
    return undefined;
  }

  try {
    return new ProxyAgent(proxyUrl);
  } catch {
    return undefined;
  }
}

const isVocabularyChunk = (value: unknown): value is VocabularyChunk => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const chunk = value as VocabularyChunk;

  return typeof chunk.id === "string" && typeof chunk.text === "string";
};

const readRequestBody = async (request: Request): Promise<VocabularyRequest> => {
  try {
    return (await request.json()) as VocabularyRequest;
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

const extractResponseText = (payload: GeminiResponsePayload | null) => {
  if (payload?.output_text) {
    return payload.output_text;
  }

  return (
    payload?.steps
      ?.flatMap((step) => step.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text))
      .join("") ?? ""
  );
};

const normalizeResults = (
  parsed: { results?: VocabularyResult[] },
  chunks: VocabularyChunk[],
) => {
  const allowedIds = new Set(chunks.map((chunk) => chunk.id));

  return (parsed.results ?? [])
    .filter((result) => allowedIds.has(result.id))
    .map((result) => ({
      id: result.id,
      terms: (Array.isArray(result.terms) ? result.terms : [])
        .filter(
          (item): item is VocabularyItem =>
            Boolean(item) &&
            typeof item.term === "string" &&
            typeof item.definition === "string",
        )
        .map((item) => ({
          definition: item.definition.trim(),
          term: item.term.trim(),
        }))
        .filter((item) => item.term && item.definition)
        .slice(0, 8),
    }));
};

const getGeminiRequestInit = (
  apiKey: string,
  body: unknown,
): GeminiRequestInit => {
  const init: GeminiRequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  };

  if (GEMINI_PROXY_AGENT) {
    init.dispatcher = GEMINI_PROXY_AGENT;
  }

  return init;
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const body = await readRequestBody(request);
  const chunks = body.chunks?.filter(isVocabularyChunk) ?? [];
  const characterCount = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);

  if (!chunks.length) {
    return Response.json({ results: [] });
  }

  if (chunks.length > MAX_CHUNKS || characterCount > MAX_CHARACTERS) {
    return Response.json(
      { error: "Vocabulary analysis request is too large." },
      { status: 413 },
    );
  }

  const prompt = [
    "You help Chinese-speaking English Bible readers.",
    "Identify genuinely difficult English vocabulary, idioms, or figurative phrases in each supplied passage.",
    "Return concise Simplified Chinese definitions.",
    "Do not include common words.",
    "Keep original term casing where useful.",
    "Input JSON:",
    JSON.stringify({ chunks }),
  ].join("\n");

  let geminiResponse: Response;

  try {
    geminiResponse = await fetch(
      GEMINI_INTERACTIONS_URL,
      getGeminiRequestInit(apiKey, {
        input: prompt,
        model: GEMINI_VOCAB_MODEL,
        response_format: {
          mime_type: "application/json",
          schema: {
            properties: {
              results: {
                items: {
                  properties: {
                    id: { type: "string" },
                    terms: {
                      items: {
                        properties: {
                          definition: {
                            description:
                              "A concise Simplified Chinese meaning for this term in context.",
                            type: "string",
                          },
                          term: {
                            description:
                              "The difficult English word or phrase from the passage.",
                            type: "string",
                          },
                        },
                        required: ["term", "definition"],
                        type: "object",
                      },
                      type: "array",
                    },
                  },
                  required: ["id", "terms"],
                  type: "object",
                },
                type: "array",
              },
            },
            required: ["results"],
            type: "object",
          },
          type: "text",
        },
      }),
    );
  } catch (error) {
    return Response.json(
      {
        error: `Expo server could not connect to Gemini API. If your VPN uses a local or browser proxy, set DEV_PROXY_URL in .env or restart Expo with npm run start:proxy. ${getErrorMessage(
          error,
        )}`,
      },
      { status: 502 },
    );
  }

  const payload = await readJsonResponse<GeminiResponsePayload>(geminiResponse);

  if (!geminiResponse.ok) {
    return Response.json(
      { error: payload?.error?.message ?? "Gemini vocabulary analysis failed." },
      { status: geminiResponse.status },
    );
  }

  const responseText = extractResponseText(payload);

  try {
    return Response.json(
      { results: normalizeResults(JSON.parse(responseText), chunks) },
      { status: 200 },
    );
  } catch {
    return Response.json(
      { error: "Gemini returned an invalid vocabulary response." },
      { status: 502 },
    );
  }
}
