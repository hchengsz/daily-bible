import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getScriptureText } from "../../data/bible";
import { readingPlanDays } from "../../data/raw";

type Reference = {
  book: string;
  chapter: number;
  verse: string;
};

type Paragraph = {
  title?: string;
  references?: Reference[];
};

type Section = {
  title?: string;
  introduction?: string;
  paragraphs?: Paragraph[];
};

type Day = {
  id: number;
  title?: string;
  introduction?: string;
  sections?: Section[];
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

type PlaybackStatus = "idle" | "playing" | "paused";

const DEFAULT_DAY: Day = { id: 0, sections: [] };
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const readingDays = readingPlanDays as unknown as Day[];

const FONT = 20;
const LINE_HEIGHT = 30;
const MIN_SPEECH_RATE = 0.6;
const MAX_SPEECH_RATE = 1.4;
const SPEECH_RATE_STEP = 0.1;
const TARGET_LANGUAGE = "zh-CN";
const TRANSLATE_PATH = "/api/translate";
const TRANSLATE_API_ORIGIN = (
  process.env.EXPO_PUBLIC_TRANSLATE_API_ORIGIN ?? ""
).replace(/\/$/, "");
const TRANSLATE_ENDPOINT = TRANSLATE_API_ORIGIN
  ? `${TRANSLATE_API_ORIGIN}${TRANSLATE_PATH}`
  : TRANSLATE_PATH;

const safeText = (text: unknown) => (typeof text === "string" ? text : "");

const normalizeText = (text?: unknown) =>
  safeText(text).replace(/\s+/g, " ").trim();

const getSections = (day?: Day | null) =>
  (Array.isArray(day?.sections) ? day.sections : []).filter(
    (section): section is Section => Boolean(section),
  );

const getParagraphs = (section?: Section | null) =>
  (Array.isArray(section?.paragraphs) ? section.paragraphs : []).filter(
    (paragraph): paragraph is Paragraph => Boolean(paragraph),
  );

const getReferences = (paragraph?: Paragraph | null) =>
  (Array.isArray(paragraph?.references) ? paragraph.references : []).filter(
    (reference): reference is Reference => Boolean(reference),
  );

const getReferenceLabel = (ref: Reference) =>
  `${ref.book} ${ref.chapter}:${ref.verse}`;

const getReferenceText = (ref: Reference) => {
  const { book, chapter, verse } = ref;

  return getScriptureText(book, chapter, verse);
};

const getParagraphReferenceLabel = (paragraph: Paragraph) =>
  getReferences(paragraph).map(getReferenceLabel).join("; ");

const getParagraphScripture = (paragraph: Paragraph) =>
  getReferences(paragraph)
    .map(getReferenceText)
    .map((text) => text.trim())
    .filter(Boolean)
    .join(" ");

const getDayTitleId = () => "day.title";

const getDayIntroductionId = () => "day.introduction";

const getSectionTitleId = (sectionIndex: number) =>
  `section.${sectionIndex}.title`;

const getSectionIntroductionId = (sectionIndex: number) =>
  `section.${sectionIndex}.introduction`;

const getParagraphTitleId = (sectionIndex: number, paragraphIndex: number) =>
  `section.${sectionIndex}.paragraph.${paragraphIndex}.title`;

const getParagraphScriptureId = (
  sectionIndex: number,
  paragraphIndex: number,
) => `section.${sectionIndex}.paragraph.${paragraphIndex}.scripture`;

const buildTranslationChunks = (day: Day): TranslationChunk[] =>
  [
    { id: getDayTitleId(), text: safeText(day.title) },
    { id: getDayIntroductionId(), text: safeText(day.introduction) },
    ...getSections(day).flatMap((section, sectionIndex) => [
      { id: getSectionTitleId(sectionIndex), text: safeText(section.title) },
      {
        id: getSectionIntroductionId(sectionIndex),
        text: safeText(section.introduction),
      },
      ...getParagraphs(section).flatMap((paragraph, paragraphIndex) => [
        {
          id: getParagraphTitleId(sectionIndex, paragraphIndex),
          text: safeText(paragraph.title),
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

const clampSpeechRate = (rate: number) =>
  Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));

const getDayOfYear = (date: Date) => {
  const startOfYear = Date.UTC(date.getFullYear(), 0, 1);
  const startOfDay = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  return Math.floor((startOfDay - startOfYear) / DAY_IN_MS) + 1;
};

const getReadingDayForDate = (date: Date) => {
  const dayOfYear = getDayOfYear(date);

  return (
    readingDays.find((readingDay) => Number(readingDay.id) === dayOfYear) ??
    DEFAULT_DAY
  );
};

export default function ReadingScreen() {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => getReadingDayForDate(new Date()), []);
  const translationChunks = useMemo(
    () => buildTranslationChunks(today),
    [today],
  );
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>("idle");
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [speechRate, setSpeechRate] = useState(0.95);
  const speechChunksRef = useRef<string[]>([]);
  const currentSpeechIndexRef = useRef(0);
  const speechRateRef = useRef(speechRate);
  const speechLanguageRef = useRef(isTranslated ? "en-US" : "en-US");
  const playbackRunRef = useRef(0);
  const isPausedInEngineRef = useRef(false);

  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);

  useEffect(() => {
    speechLanguageRef.current = isTranslated ? "en-US" : "en-US";
  }, [isTranslated]);

  useEffect(
    () => () => {
      playbackRunRef.current += 1;
      Speech.stop();
    },
    [],
  );

  const speakFromIndex = useCallback((index: number, runId: number) => {
    const chunks = speechChunksRef.current;
    const text = chunks[index];

    if (!text || index >= chunks.length) {
      setPlaybackStatus("idle");
      setCurrentSpeechIndex(0);
      currentSpeechIndexRef.current = 0;
      setIsPlayerVisible(false);
      return;
    }

    currentSpeechIndexRef.current = index;
    isPausedInEngineRef.current = false;
    setCurrentSpeechIndex(index);
    setPlaybackStatus("playing");

    Speech.speak(text, {
      language: speechLanguageRef.current,
      rate: speechRateRef.current,
      pitch: 1.0,
      onDone: () => {
        if (runId !== playbackRunRef.current) {
          return;
        }

        speakFromIndex(index + 1, runId);
      },
      onStopped: () => undefined,
    });
  }, []);

  const handlePlay = () => {
    const chunks = getSpeechChunks(
      translationChunks,
      translations,
      isTranslated,
    );

    if (!chunks.length) return;

    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;

    speechChunksRef.current = chunks;
    currentSpeechIndexRef.current = 0;
    isPausedInEngineRef.current = false;
    setCurrentSpeechIndex(0);
    setIsPlayerVisible(true);
    Speech.stop();
    speakFromIndex(0, runId);
  };

  const handlePauseResume = async () => {
    if (playbackStatus === "playing") {
      try {
        await Speech.pause();
        isPausedInEngineRef.current = true;
        setPlaybackStatus("paused");
      } catch {
        playbackRunRef.current += 1;
        isPausedInEngineRef.current = false;
        Speech.stop();
        setPlaybackStatus("paused");
      }

      return;
    }

    if (playbackStatus === "paused") {
      if (isPausedInEngineRef.current) {
        try {
          await Speech.resume();
          isPausedInEngineRef.current = false;
          setPlaybackStatus("playing");
          return;
        } catch {
          isPausedInEngineRef.current = false;
        }
      }

      const runId = playbackRunRef.current + 1;

      playbackRunRef.current = runId;
      Speech.stop();
      speakFromIndex(currentSpeechIndexRef.current, runId);
    }
  };

  const handleSkipForward = () => {
    const chunks = speechChunksRef.current;
    const nextIndex = Math.min(
      currentSpeechIndexRef.current + 1,
      chunks.length,
    );
    const runId = playbackRunRef.current + 1;

    playbackRunRef.current = runId;
    isPausedInEngineRef.current = false;
    Speech.stop();
    speakFromIndex(nextIndex, runId);
  };

  const handleSkipBackward = () => {
    const previousIndex = Math.max(currentSpeechIndexRef.current - 1, 0);
    const runId = playbackRunRef.current + 1;

    playbackRunRef.current = runId;
    isPausedInEngineRef.current = false;
    Speech.stop();
    speakFromIndex(previousIndex, runId);
  };

  const handleStopPlayback = () => {
    playbackRunRef.current += 1;
    isPausedInEngineRef.current = false;
    Speech.stop();
    setPlaybackStatus("idle");
    setIsPlayerVisible(false);
    setCurrentSpeechIndex(0);
    currentSpeechIndexRef.current = 0;
  };

  const updateSpeechRate = (nextRate: number) => {
    const rate = Number(clampSpeechRate(nextRate).toFixed(2));

    speechRateRef.current = rate;
    setSpeechRate(rate);

    if (playbackStatus === "paused") {
      playbackRunRef.current += 1;
      isPausedInEngineRef.current = false;
      Speech.stop();
      return;
    }

    if (playbackStatus === "playing") {
      const runId = playbackRunRef.current + 1;

      playbackRunRef.current = runId;
      isPausedInEngineRef.current = false;
      Speech.stop();
      speakFromIndex(currentSpeechIndexRef.current, runId);
    }
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
    safeText(today.title),
    translations,
    isTranslated,
  );
  const dayIntroduction = getDisplayText(
    getDayIntroductionId(),
    safeText(today.introduction),
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

          <Pressable
            accessibilityLabel="开始朗读"
            accessibilityRole="button"
            onPress={handlePlay}
          >
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
          paddingBottom: isPlayerVisible ? 240 : 80,
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

        {!!dayTitle.trim() && (
          <Text style={{ fontSize: 24, fontWeight: "700" }}>{dayTitle}</Text>
        )}

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
          {getSections(today).map((section, sectionIndex) => (
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
                        {sectionIntroduction}
                      </Text>
                    </View>
                  )
                );
              })()}

              {getParagraphs(section).map((p, pIndex) => {
                const paragraphTitle = getDisplayText(
                  getParagraphTitleId(sectionIndex, pIndex),
                  safeText(p.title),
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

      {isPlayerVisible && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: Math.max(18, insets.bottom + 12),
            alignItems: "center",
          }}
        >
          <BlurView
            experimentalBlurMethod="dimezisBlurView"
            intensity={88}
            pointerEvents="auto"
            tint="systemMaterial"
            style={{
              width: "100%",
              maxWidth: 620,
              borderRadius: 28,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "rgba(255, 255, 255, 0.68)",
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 18,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.72)",
              boxShadow: "0 14px 34px rgba(0, 0, 0, 0.18)",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "600" }}>
                  {playbackStatus === "paused" ? "已暂停" : "正在朗读"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: "#666",
                    fontSize: 13,
                    lineHeight: 18,
                    marginTop: 2,
                  }}
                >
                  {speechChunksRef.current[currentSpeechIndex] ?? ""}
                </Text>
              </View>

              <Pressable
                accessibilityLabel="关闭朗读控制"
                accessibilityRole="button"
                onPress={handleStopPlayback}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="close" size={24} color="#222" />
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                marginBottom: 18,
              }}
            >
              <Pressable
                accessibilityLabel="后退到上一段"
                accessibilityRole="button"
                onPress={handleSkipBackward}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.44)",
                  borderWidth: 1,
                  borderColor: "rgba(0, 0, 0, 0.12)",
                }}
              >
                <MaterialIcons name="skip-previous" size={30} color="#222" />
              </Pressable>

              <Pressable
                accessibilityLabel={
                  playbackStatus === "paused" ? "继续朗读" : "暂停朗读"
                }
                accessibilityRole="button"
                onPress={handlePauseResume}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#111",
                }}
              >
                <MaterialIcons
                  name={playbackStatus === "paused" ? "play-arrow" : "pause"}
                  size={30}
                  color="#fff"
                />
              </Pressable>

              <Pressable
                accessibilityLabel="快进到下一段"
                accessibilityRole="button"
                onPress={handleSkipForward}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.44)",
                  borderWidth: 1,
                  borderColor: "rgba(0, 0, 0, 0.12)",
                }}
              >
                <MaterialIcons name="skip-next" size={30} color="#222" />
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600" }}>
                速度 {speechRate.toFixed(1)}x
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  accessibilityLabel="降低朗读速度"
                  accessibilityRole="button"
                  onPress={() =>
                    updateSpeechRate(speechRate - SPEECH_RATE_STEP)
                  }
                  style={{
                    width: 42,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#bbb",
                  }}
                >
                  <MaterialIcons name="remove" size={22} color="#222" />
                </Pressable>

                <Pressable
                  accessibilityLabel="提高朗读速度"
                  accessibilityRole="button"
                  onPress={() =>
                    updateSpeechRate(speechRate + SPEECH_RATE_STEP)
                  }
                  style={{
                    width: 42,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#bbb",
                  }}
                >
                  <MaterialIcons name="add" size={22} color="#222" />
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}
