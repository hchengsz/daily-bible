import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Speech from "expo-speech";
import type { ComponentRef } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
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
  getDateKey,
} from "../reading/reading-plan-utils";
import { useAppearanceStore } from "../settings/appearance-store";
import { getCatechismDayForDate } from "./catechism-data";

const FONT = 20;
const LINE_HEIGHT = 30;
const MIN_SPEECH_RATE = 0.6;
const MAX_SPEECH_RATE = 1.4;
const SPEECH_RATE_STEP = 0.1;
const HEADER_EXPANDED_HEIGHT = 112;
const HEADER_COMPACT_HEIGHT = 80;
const HEADER_COLLAPSE_DISTANCE = 72;
const TARGET_LANGUAGE = "en";
const TRANSLATE_PATH = "/api/translate";
const TRANSLATE_API_ORIGIN = (
  process.env.EXPO_PUBLIC_TRANSLATE_API_ORIGIN ?? ""
).replace(/\/$/, "");
const TRANSLATE_ENDPOINT = TRANSLATE_API_ORIGIN
  ? `${TRANSLATE_API_ORIGIN}${TRANSLATE_PATH}`
  : TRANSLATE_PATH;
const HEADER_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "long",
});
const PLAYER_BLUR_METHOD = Platform.select({
  android: "dimezisBlurView" as const,
  default: undefined,
});
const PLAYER_BOTTOM_OFFSET = 15;
const PLAYER_SCROLL_PADDING = 216;
const PLAYER_RADIUS = 24;
const PLAYER_VERTICAL_PADDING = 22;
const PLAYER_HEADER_BOTTOM_GAP = 12;
const PLAYER_CONTROLS_BOTTOM_GAP = 16;
const PLAYER_CONTROL_BUTTON_SIZE = 48;
const PLAYER_CONTROL_ICON_SIZE = 28;
const PLAYER_PRIMARY_BUTTON_SIZE = 52;
const PLAYER_PRIMARY_ICON_SIZE = 30;
const PLAYER_SPEED_BUTTON_HEIGHT = 32;
const PLAYER_SPEED_BUTTON_WIDTH = Math.round(PLAYER_SPEED_BUTTON_HEIGHT * 1.618);
const PLAYER_SPEED_ICON_SIZE = 20;

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

const formatHeaderDate = (date: Date) => HEADER_MONTH_FORMATTER.format(date);

const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();

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

    return { error: responseText };
  }
};

const translateChunks = async (
  chunks: TranslationChunk[],
): Promise<TranslationMap> => {
  const response = await fetch(TRANSLATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chunks,
      targetLanguage: TARGET_LANGUAGE,
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

const getHeaderToolStyle = (disabled = false) => ({
  alignItems: "flex-end" as const,
  flexDirection: "row" as const,
  gap: 5,
  justifyContent: "center" as const,
  marginBottom: 3,
  minHeight: 44,
  opacity: disabled ? 0.45 : 1,
  paddingHorizontal: 6,
});

const getGlassIconButtonStyle = (darkModeEnabled = false) => ({
  alignItems: "center" as const,
  backgroundColor: darkModeEnabled
    ? "rgba(30, 30, 30, 0.66)"
    : "rgba(255, 255, 255, 0.34)",
  borderColor: darkModeEnabled
    ? "rgba(255, 255, 255, 0.16)"
    : "rgba(0, 0, 0, 0.1)",
  borderCurve: "continuous" as const,
  borderRadius: PLAYER_CONTROL_BUTTON_SIZE / 2,
  borderWidth: 1,
  height: PLAYER_CONTROL_BUTTON_SIZE,
  justifyContent: "center" as const,
  width: PLAYER_CONTROL_BUTTON_SIZE,
});

const getSpeedButtonStyle = (darkModeEnabled = false) => ({
  alignItems: "center" as const,
  backgroundColor: darkModeEnabled
    ? "rgba(30, 30, 30, 0.72)"
    : "rgba(255, 255, 255, 0.58)",
  borderColor: darkModeEnabled
    ? "rgba(255, 255, 255, 0.16)"
    : "rgba(0, 0, 0, 0.09)",
  borderCurve: "continuous" as const,
  borderRadius: PLAYER_SPEED_BUTTON_HEIGHT / 2,
  borderWidth: 1,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.62)",
  height: PLAYER_SPEED_BUTTON_HEIGHT,
  justifyContent: "center" as const,
  width: PLAYER_SPEED_BUTTON_WIDTH,
});

const getCenteredIconStyle = (size: number) => ({
  includeFontPadding: false,
  lineHeight: size,
  textAlign: "center" as const,
});

const getCompleteButtonLabel = (
  isCompleted: boolean,
  isSelectedToday: boolean,
) => {
  if (isCompleted) {
    return isSelectedToday
      ? "Today's catechism is complete"
      : "This catechism reading is complete";
  }

  return isSelectedToday
    ? "Complete Today's Catechism"
    : "Mark This Catechism Complete";
};

const getCompletionMessage = (isSelectedToday: boolean) =>
  isSelectedToday
    ? "Come back tomorrow and continue with the next section."
    : "You're caught up on this day. Keep going.";

export default function CatechismScreen() {
  const currentDate = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const scrollViewRef = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const scrollY = useSharedValue(0);
  const selectedDateKey = getDateKey(selectedDate);
  const currentDateKey = getDateKey(currentDate);
  const selectedDay = useMemo(
    () => getCatechismDayForDate(selectedDate),
    [selectedDate],
  );
  const translationChunks = useMemo(
    () =>
      selectedDay.entries
        .flatMap((entry) =>
          entry.text
            .split(/\n{2,}/)
            .map((paragraph, paragraphIndex) => ({
              id: `entry.${entry.number}.paragraph.${paragraphIndex}`,
              text: normalizeText(paragraph),
            })),
        )
        .filter((chunk) => chunk.text),
    [selectedDay],
  );
  const isSelectedToday = selectedDateKey === currentDateKey;
  const currentYearStartKey = Date.UTC(currentDate.getFullYear(), 0, 1);
  const canGoPreviousDay = selectedDateKey > currentYearStartKey;
  const canGoNextDay = selectedDateKey < currentDateKey;
  const completeTask = useDailyProgressStore((state) => state.completeTask);
  const isCompleted = useTaskCompletion(selectedDateKey, "catechism");
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
  const { celebrationProgress, isCelebrating, startCelebration } =
    useCompletionCelebration();
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
  const playbackRunRef = useRef(0);
  const isPausedInEngineRef = useRef(false);
  const colors = {
    background: darkModeEnabled ? "#0c0c0c" : "#fff",
    border: darkModeEnabled ? "#303030" : "#ddd",
    chip: darkModeEnabled ? "#242424" : "#e7e7e7",
    label: darkModeEnabled ? "#a5a5a5" : "#666",
    playerText: darkModeEnabled ? "#f5f5f5" : "#111",
    text: darkModeEnabled ? "#f5f5f5" : "#111",
  };
  const headerIconColor = darkModeEnabled
    ? "rgba(245, 245, 245, 0.86)"
    : "rgba(17, 17, 17, 0.82)";

  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);

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
  }, [scrollY, selectedDateKey, stopSpeechPlayback]);

  const handlePreviousDay = () => {
    if (canGoPreviousDay) {
      setSelectedDate((date) => addDays(date, -1));
    }
  };

  const handleNextDay = () => {
    if (canGoNextDay) {
      setSelectedDate((date) => addDays(date, 1));
    }
  };

  const handleCatechismScroll = useAnimatedScrollHandler((event) => {
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

  const handleCompleteCatechism = () => {
    completeTask(selectedDateKey, "catechism");
    startCelebration();
  };

  const getSpeechChunks = useCallback(
    () =>
      translationChunks
        .map((chunk) => translations[chunk.id] ?? chunk.text)
        .map(normalizeText)
        .filter(Boolean),
    [translationChunks, translations],
  );

  const speakFromIndex = useCallback(
    (index: number, runId: number) => {
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
        language: isTranslated ? "en-US" : "zh-CN",
        pitch: 1,
        rate: speechRateRef.current,
        onDone: () => {
          if (runId !== playbackRunRef.current) {
            return;
          }

          speakFromIndex(index + 1, runId);
        },
        onStopped: () => undefined,
      });
    },
    [isTranslated],
  );

  const handlePlay = () => {
    const chunks = getSpeechChunks();

    if (!chunks.length) {
      return;
    }

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
    const nextIndex = Math.min(
      currentSpeechIndexRef.current + 1,
      speechChunksRef.current.length,
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
      stopSpeechPlayback();
      return;
    }

    if (Object.keys(translations).length) {
      setIsTranslated(true);
      stopSpeechPlayback();
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const translatedChunks = await translateChunks(translationChunks);

      setTranslations(translatedChunks);
      setIsTranslated(true);
      stopSpeechPlayback();
    } catch (error) {
      setTranslationError(
        error instanceof Error ? error.message : "Translation failed.",
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const dateString = formatHeaderDate(selectedDate);
  const completeButtonLabel = getCompleteButtonLabel(
    isCompleted,
    isSelectedToday,
  );
  const completionMessage = getCompletionMessage(isSelectedToday);
  const reference =
    selectedDay.startNumber === selectedDay.endNumber
      ? `${selectedDay.startNumber}`
      : `${selectedDay.startNumber}-${selectedDay.endNumber}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View
        style={[
          {
            backgroundColor: colors.background,
            borderBottomWidth: 0.5,
            borderColor: colors.border,
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
              bottom: 7,
              flexDirection: "row",
              justifyContent: "space-between",
              left: 20,
              position: "absolute",
              right: 20,
            },
            expandedHeaderAnimatedStyle,
          ]}
        >
          <View style={{ alignItems: "center", flexDirection: "row" }}>
            <Pressable
              accessibilityLabel="View previous catechism reading"
              accessibilityRole="button"
              disabled={!canGoPreviousDay}
              onPress={handlePreviousDay}
              style={{
                alignItems: "center",
                backgroundColor: colors.chip,
                borderBottomLeftRadius: 28,
                borderTopLeftRadius: 28,
                height: 31,
                justifyContent: "center",
                opacity: canGoPreviousDay ? 1 : 0.26,
                width: 27,
              }}
            >
              <MaterialIcons
                name="chevron-left"
                size={25}
                color={colors.text}
              />
            </Pressable>

            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.chip,
                height: 31,
                justifyContent: "center",
                marginHorizontal: 2,
                minWidth: 108,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 15,
                  fontWeight: "500",
                }}
              >
                {dateString}
              </Text>
            </View>

            <Pressable
              accessibilityLabel="View next catechism reading"
              accessibilityRole="button"
              disabled={!canGoNextDay}
              onPress={handleNextDay}
              style={{
                alignItems: "center",
                backgroundColor: colors.chip,
                borderBottomRightRadius: 28,
                borderTopRightRadius: 28,
                height: 31,
                justifyContent: "center",
                opacity: canGoNextDay ? 1 : 0.26,
                width: 27,
              }}
            >
              <MaterialIcons
                name="chevron-right"
                size={25}
                color={colors.text}
              />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
            <Pressable
              accessibilityLabel="Translate catechism to English"
              accessibilityRole="button"
              disabled={isTranslating}
              onPress={handleTranslate}
              style={getHeaderToolStyle(isTranslating)}
            >
              <MaterialIcons
                name="translate"
                size={22}
                color={isTranslated ? "#2db65a" : headerIconColor}
              />
            </Pressable>

            <Pressable
              accessibilityLabel="Start catechism reading aloud"
              accessibilityRole="button"
              onPress={handlePlay}
              style={getHeaderToolStyle()}
            >
              <MaterialIcons
                name="volume-up"
                size={23}
                color={headerIconColor}
              />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            {
              bottom: 7,
              justifyContent: "center",
              left: 20,
              minHeight: 20,
              position: "absolute",
              right: 20,
            },
            compactHeaderAnimatedStyle,
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "500" }}>
            {dateString} | Catechism
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          alignSelf: "center",
          maxWidth: 1000,
          paddingBottom: isPlayerVisible ? PLAYER_SCROLL_PADDING : 80,
          paddingHorizontal: 20,
          paddingTop: 20,
          width: "100%",
        }}
        onScroll={handleCatechismScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: colors.background }}
      >
        {!!translationError && (
          <Text
            style={{
              color: darkModeEnabled ? "#ff8a8a" : "#b00020",
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 12,
            }}
          >
            {translationError}
          </Text>
        )}

        <Text
          selectable
          style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: "700",
          }}
        >
          Catechism of the Catholic Church
        </Text>

        <Text
          selectable
          style={{
            color: colors.label,
            fontSize: 15,
            lineHeight: 22,
            marginTop: 6,
          }}
        >
          天主教教理 · CCC {reference} · {selectedDay.entryCount} 条
        </Text>

        <View style={{ gap: 24, marginTop: 24 }}>
          {selectedDay.entries.map((entry) => (
            <View key={entry.number} style={{ gap: 10 }}>
              <Text
                selectable
                style={{
                  color: colors.label,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                CCC {entry.number}
              </Text>

              {entry.text.split(/\n{2,}/).filter(Boolean).map(
                (paragraph, index) => (
                  <Text
                    key={`${entry.number}:${index}`}
                    selectable
                    style={{
                      color: colors.text,
                      fontSize: FONT,
                      lineHeight: LINE_HEIGHT,
                    }}
                  >
                    {isTranslated
                      ? (translations[
                          `entry.${entry.number}.paragraph.${index}`
                        ] ?? paragraph)
                      : paragraph}
                  </Text>
                ),
              )}
            </View>
          ))}
        </View>

        <View style={{ gap: 12, marginTop: 28, paddingTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            onPress={handleCompleteCatechism}
            style={{
              alignItems: "center",
              backgroundColor: isCompleted
                ? darkModeEnabled
                  ? "#112319"
                  : "#f1f8f4"
                : darkModeEnabled
                  ? "#f5f5f5"
                  : "#111",
              borderColor: isCompleted
                ? darkModeEnabled
                  ? "#2f6d43"
                  : "#9bd8ad"
                : darkModeEnabled
                  ? "#f5f5f5"
                  : "#111",
              borderCurve: "continuous",
              borderRadius: 18,
              borderWidth: 1,
              justifyContent: "center",
              minHeight: 56,
              paddingHorizontal: 18,
            }}
          >
            <Text
              style={{
                color: isCompleted
                  ? darkModeEnabled
                    ? "#2db65a"
                    : "#1f7a3a"
                  : darkModeEnabled
                    ? "#111"
                    : "#fff",
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              {completeButtonLabel}
            </Text>
          </Pressable>

          {isCompleted && (
            <Text
              selectable
              style={{
                color: colors.label,
                fontSize: 14,
                lineHeight: 20,
                textAlign: "center",
              }}
            >
              {completionMessage}
            </Text>
          )}
        </View>
      </Animated.ScrollView>

      <CompletionCelebrationOverlay
        isVisible={isCelebrating}
        progress={celebrationProgress}
      />

      {isPlayerVisible && (
        <View
          style={{
            alignItems: "center",
            bottom: PLAYER_BOTTOM_OFFSET,
            left: 16,
            pointerEvents: "box-none",
            position: "absolute",
            right: 16,
          }}
        >
          <BlurView
            experimentalBlurMethod={PLAYER_BLUR_METHOD}
            intensity={92}
            tint={
              Platform.OS === "ios"
                ? darkModeEnabled
                  ? "systemThinMaterialDark"
                  : "systemThinMaterialLight"
                : darkModeEnabled
                  ? "dark"
                  : "light"
            }
            style={{
              backgroundColor: darkModeEnabled
                ? "rgba(16, 16, 16, 0.28)"
                : "rgba(255, 255, 255, 0.14)",
              borderColor: darkModeEnabled
                ? "rgba(255, 255, 255, 0.16)"
                : "rgba(255, 255, 255, 0.42)",
              borderCurve: "continuous",
              borderRadius: PLAYER_RADIUS,
              borderWidth: 1,
              boxShadow: "0 14px 34px rgba(0, 0, 0, 0.18)",
              maxWidth: 620,
              overflow: "hidden",
              paddingBottom: PLAYER_VERTICAL_PADDING,
              paddingHorizontal: 16,
              paddingTop: PLAYER_VERTICAL_PADDING,
              pointerEvents: "auto",
              width: "100%",
            }}
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: PLAYER_HEADER_BOTTOM_GAP,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    color: colors.playerText,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {playbackStatus === "paused" ? "Paused" : "Reading aloud"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.label,
                    fontSize: 13,
                    lineHeight: 18,
                    marginTop: 2,
                  }}
                >
                  {speechChunksRef.current[currentSpeechIndex] ?? ""}
                </Text>
              </View>

              <Pressable
                accessibilityLabel="Close catechism reading controls"
                accessibilityRole="button"
                onPress={stopSpeechPlayback}
                style={{
                  alignItems: "center",
                  height: 36,
                  justifyContent: "center",
                  width: 36,
                }}
              >
                <MaterialIcons
                  name="close"
                  size={24}
                  color={colors.playerText}
                />
              </Pressable>
            </View>

            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: 14,
                justifyContent: "center",
                marginBottom: PLAYER_CONTROLS_BOTTOM_GAP,
                minHeight: PLAYER_PRIMARY_BUTTON_SIZE,
              }}
            >
              <Pressable
                accessibilityLabel="Go back to previous catechism passage"
                accessibilityRole="button"
                onPress={handleSkipBackward}
                style={getGlassIconButtonStyle(darkModeEnabled)}
              >
                <MaterialIcons
                  name="skip-previous"
                  size={PLAYER_CONTROL_ICON_SIZE}
                  color={colors.playerText}
                  style={getCenteredIconStyle(PLAYER_CONTROL_ICON_SIZE)}
                />
              </Pressable>

              <Pressable
                accessibilityLabel={
                  playbackStatus === "paused"
                    ? "Resume catechism reading aloud"
                    : "Pause catechism reading aloud"
                }
                accessibilityRole="button"
                onPress={handlePauseResume}
                style={{
                  alignItems: "center",
                  backgroundColor: darkModeEnabled
                    ? "rgba(245, 245, 245, 0.9)"
                    : "rgba(17, 17, 17, 0.86)",
                  borderColor: "rgba(255, 255, 255, 0.48)",
                  borderRadius: PLAYER_PRIMARY_BUTTON_SIZE / 2,
                  borderWidth: 1,
                  boxShadow: "0 8px 18px rgba(0, 0, 0, 0.14)",
                  height: PLAYER_PRIMARY_BUTTON_SIZE,
                  justifyContent: "center",
                  width: PLAYER_PRIMARY_BUTTON_SIZE,
                }}
              >
                <MaterialIcons
                  name={playbackStatus === "paused" ? "play-arrow" : "pause"}
                  size={PLAYER_PRIMARY_ICON_SIZE}
                  color={darkModeEnabled ? "#111" : "#fff"}
                  style={getCenteredIconStyle(PLAYER_PRIMARY_ICON_SIZE)}
                />
              </Pressable>

              <Pressable
                accessibilityLabel="Skip to next catechism passage"
                accessibilityRole="button"
                onPress={handleSkipForward}
                style={getGlassIconButtonStyle(darkModeEnabled)}
              >
                <MaterialIcons
                  name="skip-next"
                  size={PLAYER_CONTROL_ICON_SIZE}
                  color={colors.playerText}
                  style={getCenteredIconStyle(PLAYER_CONTROL_ICON_SIZE)}
                />
              </Pressable>
            </View>

            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                minHeight: PLAYER_SPEED_BUTTON_HEIGHT,
              }}
            >
              <Text
                style={{
                  color: colors.playerText,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                Speed {speechRate.toFixed(1)}x
              </Text>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  accessibilityLabel="Decrease catechism reading speed"
                  accessibilityRole="button"
                  onPress={() =>
                    updateSpeechRate(speechRate - SPEECH_RATE_STEP)
                  }
                  style={getSpeedButtonStyle(darkModeEnabled)}
                >
                  <MaterialIcons
                    name="remove"
                    size={PLAYER_SPEED_ICON_SIZE}
                    color={colors.playerText}
                    style={getCenteredIconStyle(PLAYER_SPEED_ICON_SIZE)}
                  />
                </Pressable>

                <Pressable
                  accessibilityLabel="Increase catechism reading speed"
                  accessibilityRole="button"
                  onPress={() =>
                    updateSpeechRate(speechRate + SPEECH_RATE_STEP)
                  }
                  style={getSpeedButtonStyle(darkModeEnabled)}
                >
                  <MaterialIcons
                    name="add"
                    size={PLAYER_SPEED_ICON_SIZE}
                    color={colors.playerText}
                    style={getCenteredIconStyle(PLAYER_SPEED_ICON_SIZE)}
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
