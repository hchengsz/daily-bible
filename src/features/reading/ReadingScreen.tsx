import { useMemo, useState } from "react";
import * as Speech from "expo-speech";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { getVerse, getVerseRange } from "../../data/bible";
import readingPlan from "../../data/raw/day147.json";

type Reference = {
  book: string;
  chapter: number;
  verse: string;
};

type Paragraph = {
  title: string;
  references: Reference[];
};

type Section = {
  title?: string;
  introduction?: string;
  paragraphs: Paragraph[];
};

type Day = {
  id: number;
  title: string;
  introduction: string;
  sections: Section[];
};

type TranslationChunk = {
  id: string;
  text: string;
};

type TranslationMap = Record<string, string>;

type TranslationResponse = {
  translations?: TranslationChunk[];
  error?: string;
};

const FONT = 20;
const LINE_HEIGHT = 30;
const TARGET_LANGUAGE = "Simplified Chinese";
const TRANSLATE_PATH = "/api/translate";
const TRANSLATE_API_ORIGIN = (
  process.env.EXPO_PUBLIC_TRANSLATE_API_ORIGIN ?? ""
).replace(/\/$/, "");
const TRANSLATE_ENDPOINT = TRANSLATE_API_ORIGIN
  ? `${TRANSLATE_API_ORIGIN}${TRANSLATE_PATH}`
  : TRANSLATE_PATH;

const extractVerseNumber = (verse: string) =>
  Number(verse.replace(/[^\d]/g, ""));

const normalizeText = (text?: string | null) =>
  text?.replace(/\s+/g, " ").trim() ?? "";

const getReferenceLabel = (ref: Reference) =>
  `${ref.book} ${ref.chapter}:${ref.verse}`;

const getReferenceText = (ref: Reference) => {
  const { book, chapter, verse } = ref;

  if (verse.includes("-")) {
    const [startRaw, endRaw] = verse.split("-");
    const start = extractVerseNumber(startRaw);
    const end = extractVerseNumber(endRaw);

    return getVerseRange(book, chapter, start, end).join("");
  }

  const verseNum = extractVerseNumber(verse);

  return getVerse(book, chapter, verseNum) ?? "";
};

const getParagraphReferenceLabel = (paragraph: Paragraph) =>
  paragraph.references.map(getReferenceLabel).join("; ");

const getParagraphScripture = (paragraph: Paragraph) =>
  paragraph.references.map(getReferenceText).filter(Boolean).join("");

const getDayTitleId = () => "day.title";

const getDayIntroductionId = () => "day.introduction";

const getSectionTitleId = (sectionIndex: number) =>
  `section.${sectionIndex}.title`;

const getSectionIntroductionId = (sectionIndex: number) =>
  `section.${sectionIndex}.introduction`;

const getParagraphTitleId = (sectionIndex: number, paragraphIndex: number) =>
  `section.${sectionIndex}.paragraph.${paragraphIndex}.title`;

const getParagraphScriptureId = (sectionIndex: number, paragraphIndex: number) =>
  `section.${sectionIndex}.paragraph.${paragraphIndex}.scripture`;

const buildTranslationChunks = (day: Day): TranslationChunk[] =>
  [
    { id: getDayTitleId(), text: day.title },
    { id: getDayIntroductionId(), text: day.introduction },
    ...day.sections.flatMap((section, sectionIndex) => [
      { id: getSectionTitleId(sectionIndex), text: section.title ?? "" },
      {
        id: getSectionIntroductionId(sectionIndex),
        text: section.introduction ?? "",
      },
      ...section.paragraphs.flatMap((paragraph, paragraphIndex) => [
        {
          id: getParagraphTitleId(sectionIndex, paragraphIndex),
          text: paragraph.title,
        },
        {
          id: getParagraphScriptureId(sectionIndex, paragraphIndex),
          text: getParagraphScripture(paragraph),
        },
      ]),
    ]),
  ].filter((chunk) => normalizeText(chunk.text));

const getDisplayText = (
  id: string,
  fallback: string,
  translations: TranslationMap,
  isTranslated: boolean,
) => {
  if (!isTranslated) {
    return fallback;
  }

  return translations[id] ?? fallback;
};

const getSpeechChunks = (
  chunks: TranslationChunk[],
  translations: TranslationMap,
  isTranslated: boolean,
) =>
  chunks
    .flatMap((chunk) =>
      getDisplayText(chunk.id, chunk.text, translations, isTranslated).split(
        /\n{2,}/,
      ),
    )
    .map(normalizeText)
    .filter(Boolean);

const parseTranslationResponse = async (
  response: Response,
): Promise<TranslationResponse> => {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText) as TranslationResponse;
  } catch {
    if (response.status === 404) {
      return {
        error:
          "Translation API route was not found. Restart the Expo dev server so app/api/translate+api.ts is registered.",
      };
    }

    return {
      error: responseText,
    };
  }
};

const translateChunks = async (
  chunks: TranslationChunk[],
): Promise<TranslationMap> => {
  const response = await fetch(TRANSLATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetLanguage: TARGET_LANGUAGE,
      chunks,
    }),
  });
  const data = await parseTranslationResponse(response);

  if (!response.ok) {
    throw new Error(data.error || `Translation failed: ${response.status}`);
  }

  return Object.fromEntries(
    (data.translations ?? []).map((translation) => [
      translation.id,
      translation.text,
    ]),
  );
};

export default function ReadingScreen() {
  const today = readingPlan[0] as Day;
  const translationChunks = useMemo(() => buildTranslationChunks(today), [today]);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const handlePlay = () => {
    const chunks = getSpeechChunks(
      translationChunks,
      translations,
      isTranslated,
    );

    if (!chunks.length) return;

    Speech.stop();

    const speakChunk = (index: number) => {
      const text = chunks[index];

      if (!text) return;

      Speech.speak(text, {
        language: isTranslated ? "zh-CN" : "en-US",
        rate: 0.95,
        pitch: 1.0,
        onDone: () => speakChunk(index + 1),
      });
    };

    speakChunk(0);
  };

  const handleTranslate = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }

    if (Object.keys(translations).length) {
      setIsTranslated(true);
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const translatedChunks = await translateChunks(translationChunks);

      setTranslations(translatedChunks);
      setIsTranslated(true);
    } catch (error) {
      setTranslationError(
        error instanceof Error ? error.message : "Translation failed.",
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const now = new Date();
  const dateString = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dayTitle = getDisplayText(
    getDayTitleId(),
    today.title,
    translations,
    isTranslated,
  );
  const dayIntroduction = getDisplayText(
    getDayIntroductionId(),
    today.introduction,
    translations,
    isTranslated,
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={{
          height: 80,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingBottom: 5,
          borderBottomWidth: 0.5,
          borderColor: "#ddd",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{dateString}</Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pressable
            accessibilityRole="button"
            disabled={isTranslating}
            onPress={handleTranslate}
            style={{
              minWidth: 64,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "#333",
              opacity: isTranslating ? 0.5 : 1,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600" }}>
              {isTranslating ? "翻译中" : isTranslated ? "原文" : "翻译"}
            </Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={handlePlay}>
            <Image
              source={require("../../../assets/images/outline_speaker_icon.svg")}
              style={{ width: 24, height: 24 }}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 80,
        }}
      >
        {!!translationError && (
          <Text
            style={{
              color: "#b00020",
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 12,
            }}
          >
            {translationError}
          </Text>
        )}

        <Text style={{ fontSize: 24, fontWeight: "700" }}>{dayTitle}</Text>

        {!!dayIntroduction.trim() && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: "#f5f5f5",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 0,
              borderLeftColor: "#999",
            }}
          >
            <Text
              style={{
                fontSize: FONT,
                lineHeight: LINE_HEIGHT,
                color: "#333",
              }}
            >
              {dayIntroduction}
            </Text>
          </View>
        )}

        <View style={{ marginTop: 24, gap: 28 }}>
          {today.sections.map((section, sectionIndex) => (
            <View key={sectionIndex}>
              {(() => {
                const sectionTitle = getDisplayText(
                  getSectionTitleId(sectionIndex),
                  section.title ?? "",
                  translations,
                  isTranslated,
                );

                return (
                  !!sectionTitle.trim() && (
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "600",
                        marginBottom: 8,
                      }}
                    >
                      {sectionTitle}
                    </Text>
                  )
                );
              })()}

              {(() => {
                const sectionIntroduction = getDisplayText(
                  getSectionIntroductionId(sectionIndex),
                  section.introduction ?? "",
                  translations,
                  isTranslated,
                );

                return (
                  !!sectionIntroduction.trim() && (
                    <View
                      style={{
                        marginTop: 12,
                        backgroundColor: "#f5f5f5",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderRadius: 10,
                        borderLeftWidth: 4,
                        borderLeftColor: "#999",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: FONT,
                          lineHeight: LINE_HEIGHT,
                          color: "#333",
                        }}
                      >
                        {sectionIntroduction}
                      </Text>
                    </View>
                  )
                );
              })()}

              {section.paragraphs.map((p, pIndex) => {
                const paragraphTitle = getDisplayText(
                  getParagraphTitleId(sectionIndex, pIndex),
                  p.title,
                  translations,
                  isTranslated,
                );
                const paragraphScripture = getDisplayText(
                  getParagraphScriptureId(sectionIndex, pIndex),
                  getParagraphScripture(p),
                  translations,
                  isTranslated,
                );

                return (
                  <View key={pIndex} style={{ marginBottom: 18 }}>
                    <Text
                      style={{
                        fontSize: FONT,
                        fontWeight: "500",
                        marginBottom: 6,
                      }}
                    >
                      {paragraphTitle}
                    </Text>

                    <View style={{ marginBottom: 10 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#666",
                          marginBottom: 4,
                        }}
                      >
                        {getParagraphReferenceLabel(p)}
                      </Text>

                      <Text
                        style={{
                          fontSize: FONT,
                          lineHeight: LINE_HEIGHT,
                        }}
                      >
                        {paragraphScripture || "[missing]"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
