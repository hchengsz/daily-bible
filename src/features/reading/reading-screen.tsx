import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Speech from "expo-speech";
import type { ComponentRef } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getScriptureText } from "../../data/bible";
import {
  CompletionCelebrationOverlay,
  useCompletionCelebration,
} from "../progress/completion-celebration";
import {
  useDailyProgressStore,
  useTaskCompletion,
} from "../progress/daily-progress-store";
import {
  addDays,
  DAY_IN_MS,
  formatDate,
  getDateKey,
  getDayOfYear,
  getParagraphReferenceLabel,
  getParagraphs,
  getReadingDayForDate,
  getReferences,
  getSections,
  hasReadingDayForDate,
  type Day,
  type Paragraph,
  type Reference,
} from "./reading-plan-utils";

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

const FONT = 20;
const LINE_HEIGHT = 30;
const MIN_SPEECH_RATE = 0.6;
const MAX_SPEECH_RATE = 1.4;
const SPEECH_RATE_STEP = 0.1;
const TARGET_LANGUAGE = "zh-CN";
const TRANSLATE_PATH = "/api/translate";
const SWIPE_THRESHOLD = 76;
const HEADER_EXPANDED_HEIGHT = 100;
const HEADER_COMPACT_HEIGHT = 80;
const HEADER_COLLAPSE_DISTANCE = 72;
const TRANSLATE_API_ORIGIN = (
  process.env.EXPO_PUBLIC_TRANSLATE_API_ORIGIN ?? ""
).replace(/\/$/, "");
const TRANSLATE_ENDPOINT = TRANSLATE_API_ORIGIN
  ? `${TRANSLATE_API_ORIGIN}${TRANSLATE_PATH}`
  : TRANSLATE_PATH;

const safeText = (text: unknown) => (typeof text === "string" ? text : "");

const normalizeText = (text?: unknown) =>
  safeText(text).replace(/\s+/g, " ").trim();

const getReferenceText = (ref: Reference) => {
  const { book, chapter, verse } = ref;

  return getScriptureText(book, chapter, verse);
};

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

const getRelativeDateLabel = (date: Date, currentDate: Date) => {
  const distance = Math.round(
    (getDateKey(currentDate) - getDateKey(date)) / DAY_IN_MS,
  );

  if (distance === 0) {
    return "今日";
  }

  if (distance === 1) {
    return "昨日";
  }

  if (distance === 2) {
    return "前日";
  }

  return `第 ${getDayOfYear(date)} 天`;
};

const getCompleteButtonLabel = (
  isCompleted: boolean,
  isSelectedToday: boolean,
) => {
  if (isCompleted) {
    return isSelectedToday ? "今日经文已完成" : "这日经文已完成";
  }

  return isSelectedToday ? "完成今日经文" : "标记这日完成";
};

const getCompletionMessage = (isSelectedToday: boolean) =>
  isSelectedToday
    ? "明天继续回来，一天一点也很好。"
    : "这一天也补上了，继续保持。";

const getActionButtonStyle = ({
  completed = false,
  disabled = false,
  minWidth,
  tone = "primary",
}: {
  completed?: boolean;
  disabled?: boolean;
  minWidth?: number;
  tone?: "primary" | "glass";
} = {}) => ({
  ...(minWidth ? { minWidth } : {}),
  alignItems: "center" as const,
  backgroundColor: completed
    ? "rgba(42, 145, 75, 0.12)"
    : tone === "glass"
      ? "rgba(255, 255, 255, 0.58)"
      : "rgba(17, 17, 17, 0.88)",
  borderColor: completed
    ? "rgba(42, 145, 75, 0.24)"
    : tone === "glass"
      ? "rgba(0, 0, 0, 0.09)"
      : "rgba(255, 255, 255, 0.48)",
  borderCurve: "continuous" as const,
  borderRadius: 18,
  borderWidth: 1,
  boxShadow:
    tone === "glass"
      ? "inset 0 1px 0 rgba(255, 255, 255, 0.62)"
      : "0 8px 18px rgba(0, 0, 0, 0.12)",
  justifyContent: "center" as const,
  minHeight: 56,
  opacity: disabled ? 0.5 : 1,
  paddingHorizontal: 18,
});

const getActionButtonTextStyle = (completed = false) => ({
  color: completed ? "#1f7a3a" : "#000000",
  fontSize: 16,
  fontWeight: "700" as const,
});

const getActionButtonIconColor = (completed = false) =>
  completed ? "#1f7a3a" : "#000000";

const getHeaderToolStyle = (disabled = false) => ({
  alignItems: "center" as const,
  flexDirection: "row" as const,
  gap: 5,
  justifyContent: "center" as const,
  minHeight: 44,
  opacity: disabled ? 0.45 : 1,
  paddingHorizontal: 6,
});

const getGlassIconButtonStyle = () => ({
  alignItems: "center" as const,
  backgroundColor: "rgba(255, 255, 255, 0.5)",
  borderColor: "rgba(0, 0, 0, 0.1)",
  borderCurve: "continuous" as const,
  borderRadius: 26,
  borderWidth: 1,
  height: 52,
  justifyContent: "center" as const,
  width: 52,
});

export default function ReadingScreen() {
  const insets = useSafeAreaInsets();
  const currentDate = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(() => currentDate);
  const scrollViewRef = useRef<ComponentRef<typeof Animated.ScrollView> | null>(
    null,
  );
  const scrollY = useSharedValue(0);
  const selectedDateKey = getDateKey(selectedDate);
  const selectedDay = useMemo(
    () => getReadingDayForDate(selectedDate),
    [selectedDate],
  );
  const selectedDayOfYear = useMemo(
    () => getDayOfYear(selectedDate),
    [selectedDate],
  );
  const isSelectedToday = getDateKey(selectedDate) === getDateKey(currentDate);
  const canGoPreviousDay = hasReadingDayForDate(addDays(selectedDate, -1));
  const canGoNextDay =
    getDateKey(selectedDate) < getDateKey(currentDate) &&
    hasReadingDayForDate(addDays(selectedDate, 1));
  const translationChunks = useMemo(
    () => buildTranslationChunks(selectedDay),
    [selectedDay],
  );
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const completeTask = useDailyProgressStore((state) => state.completeTask);
  const isCompleted = useTaskCompletion(selectedDateKey, "reading");
  const { celebrationProgress, isCelebrating, startCelebration } =
    useCompletionCelebration();
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>("idle");
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [speechRate, setSpeechRate] = useState(0.95);
  const speechChunksRef = useRef<string[]>([]);
  const currentSpeechIndexRef = useRef(0);
  const speechRateRef = useRef(speechRate);
  const speechLanguageRef = useRef(isTranslated ? "zh-CN" : "en-US");
  const playbackRunRef = useRef(0);
  const isPausedInEngineRef = useRef(false);

  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);

  useEffect(() => {
    speechLanguageRef.current = isTranslated ? "zh-CN" : "en-US";
  }, [isTranslated]);

  useEffect(
    () => () => {
      playbackRunRef.current += 1;
      Speech.stop();
    },
    [],
  );

  const stopSpeechPlayback = useCallback(() => {
    playbackRunRef.current += 1;
    isPausedInEngineRef.current = false;
    Speech.stop();
    setPlaybackStatus("idle");
    setIsPlayerVisible(false);
    setCurrentSpeechIndex(0);
    currentSpeechIndexRef.current = 0;
  }, []);

  useEffect(() => {
    stopSpeechPlayback();
    setTranslations({});
    setIsTranslated(false);
    setIsTranslating(false);
    setTranslationError(null);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.value = 0;
  }, [scrollY, selectedDayOfYear, stopSpeechPlayback]);

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
    stopSpeechPlayback();
  };

  const handlePreviousDay = useCallback(() => {
    if (!canGoPreviousDay) {
      return;
    }

    setSelectedDate((date) => addDays(date, -1));
  }, [canGoPreviousDay]);

  const handleNextDay = useCallback(() => {
    if (!canGoNextDay) {
      return;
    }

    setSelectedDate((date) => addDays(date, 1));
  }, [canGoNextDay]);

  const handleReadingScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_DISTANCE],
      [HEADER_EXPANDED_HEIGHT, HEADER_COMPACT_HEIGHT],
      Extrapolation.CLAMP,
    ),
  }));

  const expandedHeaderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_DISTANCE * 0.7],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, HEADER_COLLAPSE_DISTANCE],
          [0, -8],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const compactHeaderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HEADER_COLLAPSE_DISTANCE * 0.35, HEADER_COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, HEADER_COLLAPSE_DISTANCE],
          [8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 24 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > SWIPE_THRESHOLD) {
            handlePreviousDay();
            return;
          }

          if (gestureState.dx < -SWIPE_THRESHOLD) {
            handleNextDay();
          }
        },
      }),
    [handleNextDay, handlePreviousDay],
  );

  const handleCompleteReading = () => {
    if (!selectedDay.id) {
      return;
    }

    completeTask(selectedDateKey, "reading");
    startCelebration();
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

  const dateString = formatDate(selectedDate);
  const relativeDateLabel = getRelativeDateLabel(selectedDate, currentDate);
  const completeButtonLabel = getCompleteButtonLabel(
    isCompleted,
    isSelectedToday,
  );
  const completionMessage = getCompletionMessage(isSelectedToday);
  const dayTitle = getDisplayText(
    getDayTitleId(),
    safeText(selectedDay.title),
    translations,
    isTranslated,
  );
  const dayIntroduction = getDisplayText(
    getDayIntroductionId(),
    safeText(selectedDay.introduction),
    translations,
    isTranslated,
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Animated.View
        style={[
          {
            borderBottomWidth: 0.5,
            borderColor: "#ddd",
            overflow: "hidden",
            paddingHorizontal: 20,
          },
          headerAnimatedStyle,
        ]}
      >
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              alignItems: "flex-end",
              bottom: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              left: 20,
              position: "absolute",
              right: 20,
            },
            expandedHeaderAnimatedStyle,
          ]}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Pressable
              accessibilityLabel="查看前一日经文"
              accessibilityRole="button"
              disabled={!canGoPreviousDay}
              onPress={handlePreviousDay}
              style={{
                width: 34,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                opacity: canGoPreviousDay ? 1 : 0.26,
              }}
            >
              <MaterialIcons name="chevron-left" size={28} color="#222" />
            </Pressable>

            <View style={{ minWidth: 108 }}>
              <Text style={{ fontSize: 18, fontWeight: "600" }}>
                {dateString}
              </Text>
              <Text style={{ color: "#777", fontSize: 12, marginTop: 2 }}>
                {relativeDateLabel}
              </Text>
            </View>

            <Pressable
              accessibilityLabel="查看后一日经文"
              accessibilityRole="button"
              disabled={!canGoNextDay}
              onPress={handleNextDay}
              style={{
                width: 34,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                opacity: canGoNextDay ? 1 : 0.26,
              }}
            >
              <MaterialIcons name="chevron-right" size={28} color="#222" />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Pressable
              accessibilityRole="button"
              disabled={isTranslating}
              onPress={handleTranslate}
              style={getHeaderToolStyle(isTranslating)}
            >
              <MaterialIcons
                name="translate"
                size={20}
                color="rgba(17, 17, 17, 0.82)"
              />
              <Text
                style={{
                  color: "rgba(17, 17, 17, 0.82)",
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                {isTranslating ? "翻译中" : isTranslated ? "原文" : "翻译"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="开始朗读"
              accessibilityRole="button"
              onPress={handlePlay}
              style={getHeaderToolStyle()}
            >
              <MaterialIcons
                name="volume-up"
                size={21}
                color="rgba(17, 17, 17, 0.82)"
              />
              <Text
                style={{
                  color: "rgba(17, 17, 17, 0.82)",
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                朗读
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            {
              bottom: 10,
              justifyContent: "center",
              left: 20,
              minHeight: 56,
              position: "absolute",
              right: 20,
            },
            compactHeaderAnimatedStyle,
          ]}
        >
          <Text style={{ fontSize: 18, fontWeight: "600" }}>{dateString}</Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        {...panResponder.panHandlers}
        onScroll={handleReadingScroll}
        scrollEventThrottle={16}
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
          {getSections(selectedDay).map((section, sectionIndex) => (
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

        {!!selectedDay.id && (
          <View
            style={{
              marginTop: 12,
              paddingTop: 8,
              gap: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={handleCompleteReading}
              style={getActionButtonStyle({ completed: isCompleted })}
            >
              <Text style={getActionButtonTextStyle(isCompleted)}>
                {completeButtonLabel}
              </Text>
            </Pressable>

            {isCompleted && (
              <Text
                style={{
                  color: "#777",
                  fontSize: 14,
                  lineHeight: 20,
                  textAlign: "center",
                }}
              >
                {completionMessage}
              </Text>
            )}
          </View>
        )}
      </Animated.ScrollView>

      <CompletionCelebrationOverlay
        isVisible={isCelebrating}
        progress={celebrationProgress}
      />

      {isPlayerVisible && (
        <View
          style={{
            alignItems: "center",
            left: 16,
            pointerEvents: "box-none",
            position: "absolute",
            right: 16,
            bottom: Math.max(18, insets.bottom + 12),
          }}
        >
          <BlurView
            experimentalBlurMethod="dimezisBlurView"
            intensity={88}
            tint="systemMaterial"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.68)",
              borderRadius: 28,
              borderCurve: "continuous",
              borderColor: "rgba(255, 255, 255, 0.72)",
              borderWidth: 1,
              boxShadow: "0 14px 34px rgba(0, 0, 0, 0.18)",
              maxWidth: 620,
              overflow: "hidden",
              paddingBottom: 18,
              paddingHorizontal: 18,
              paddingTop: 16,
              pointerEvents: "auto",
              width: "100%",
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
                  ...getGlassIconButtonStyle(),
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
                  backgroundColor: "rgba(17, 17, 17, 0.86)",
                  borderColor: "rgba(255, 255, 255, 0.48)",
                  borderWidth: 1,
                  boxShadow: "0 8px 18px rgba(0, 0, 0, 0.14)",
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
                  ...getGlassIconButtonStyle(),
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
                    ...getActionButtonStyle({ minWidth: 56, tone: "glass" }),
                    paddingHorizontal: 0,
                  }}
                >
                  <MaterialIcons
                    name="remove"
                    size={22}
                    color={getActionButtonIconColor()}
                  />
                </Pressable>

                <Pressable
                  accessibilityLabel="提高朗读速度"
                  accessibilityRole="button"
                  onPress={() =>
                    updateSpeechRate(speechRate + SPEECH_RATE_STEP)
                  }
                  style={{
                    ...getActionButtonStyle({ minWidth: 56, tone: "glass" }),
                    paddingHorizontal: 0,
                  }}
                >
                  <MaterialIcons
                    name="add"
                    size={22}
                    color={getActionButtonIconColor()}
                  />
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}
