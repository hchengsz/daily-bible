import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getScriptureText } from "../../data/bible";
import { readingPlanDays } from "../../data/reading-plan";

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
const SWIPE_THRESHOLD = 76;
const CONFETTI_COLORS = [
  "#d9480f",
  "#f08c00",
  "#f2c94c",
  "#2f9e44",
  "#1971c2",
  "#7048e8",
  "#c2255c",
];
const CONFETTI_PIECES = Array.from({ length: 42 }, (_, index) => ({
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  delay: (index % 7) * 0.045,
  drift: ((index % 9) - 4) * 18,
  leftRatio: ((index * 37) % 100) / 100,
  rotate: (index % 2 === 0 ? 1 : -1) * (140 + (index % 5) * 38),
  size: 7 + (index % 4) * 2,
  travel: 380 + (index % 6) * 38,
}));
const FIREWORK_SPARKS = Array.from({ length: 18 }, (_, index) => ({
  angle: (Math.PI * 2 * index) / 18,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  distance: 76 + (index % 3) * 24,
  size: 5 + (index % 3),
}));
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

const getDateKey = (date: Date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

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

const getReadingDayForDate = (date: Date) => {
  const dayOfYear = getDayOfYear(date);

  return (
    readingDays.find((readingDay) => Number(readingDay.id) === dayOfYear) ??
    DEFAULT_DAY
  );
};

const hasReadingDayForDate = (date: Date) => {
  const dayOfYear = getDayOfYear(date);

  return readingDays.some((readingDay) => Number(readingDay.id) === dayOfYear);
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

export default function ReadingScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const currentDate = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(() => currentDate);
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
  const [completedDayIds, setCompletedDayIds] = useState<
    Record<number, boolean>
  >({});
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>("idle");
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [speechRate, setSpeechRate] = useState(0.95);
  const confettiProgress = useRef(new Animated.Value(0)).current;
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
  }, [selectedDayOfYear, stopSpeechPlayback]);

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

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    setCompletedDayIds((current) => ({
      ...current,
      [selectedDay.id]: true,
    }));
    setIsCelebrating(true);
    confettiProgress.setValue(0);
    Animated.timing(confettiProgress, {
      duration: 1900,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start(() => setIsCelebrating(false));
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
  const isCompleted = Boolean(completedDayIds[selectedDay.id]);
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
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <Pressable
            accessibilityLabel="查看前一日经文"
            accessibilityRole="button"
            disabled={!canGoPreviousDay}
            onPress={handlePreviousDay}
            style={{
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              opacity: canGoPreviousDay ? 1 : 0.26,
            }}
          >
            <MaterialIcons name="chevron-left" size={28} color="#222" />
          </Pressable>

          <View style={{ minWidth: 132 }}>
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
              height: 34,
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
        {...panResponder.panHandlers}
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
              style={{
                minHeight: 56,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isCompleted ? "#f1f8f4" : "#111",
                borderRadius: 18,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: isCompleted ? "#9bd8ad" : "#111",
                paddingHorizontal: 18,
              }}
            >
              <Text
                style={{
                  color: isCompleted ? "#1f7a3a" : "#fff",
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
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
      </ScrollView>

      {isCelebrating && (
        <View
          style={{
            bottom: 0,
            left: 0,
            pointerEvents: "none",
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 5,
          }}
        >
          {FIREWORK_SPARKS.map((spark, index) => {
            const translateX = confettiProgress.interpolate({
              extrapolate: "clamp",
              inputRange: [0, 0.12, 0.52],
              outputRange: [0, 0, Math.cos(spark.angle) * spark.distance],
            });
            const translateY = confettiProgress.interpolate({
              extrapolate: "clamp",
              inputRange: [0, 0.12, 0.52],
              outputRange: [0, 0, Math.sin(spark.angle) * spark.distance],
            });
            const opacity = confettiProgress.interpolate({
              extrapolate: "clamp",
              inputRange: [0, 0.1, 0.5, 0.82],
              outputRange: [0, 1, 1, 0],
            });

            return (
              <Animated.View
                key={`spark-${index}`}
                style={{
                  backgroundColor: spark.color,
                  borderRadius: spark.size / 2,
                  height: spark.size,
                  left: windowWidth / 2,
                  opacity,
                  position: "absolute",
                  top: Math.max(150, windowHeight * 0.28),
                  transform: [{ translateX }, { translateY }],
                  width: spark.size,
                }}
              />
            );
          })}

          {CONFETTI_PIECES.map((piece, index) => {
            const start = Math.max(piece.delay, 0.01);
            const translateX = confettiProgress.interpolate({
              extrapolate: "clamp",
              inputRange: [0, start, 1],
              outputRange: [0, 0, piece.drift],
            });
            const translateY = confettiProgress.interpolate({
              extrapolate: "clamp",
              inputRange: [0, start, 1],
              outputRange: [-24, -24, piece.travel],
            });
            const rotate = confettiProgress.interpolate({
              extrapolate: "clamp",
              inputRange: [0, start, 1],
              outputRange: ["0deg", "0deg", `${piece.rotate}deg`],
            });
            const opacity = confettiProgress.interpolate({
              extrapolate: "clamp",
              inputRange: [0, start, Math.min(start + 0.16, 0.82), 1],
              outputRange: [0, 0, 1, 0],
            });

            return (
              <Animated.View
                key={`confetti-${index}`}
                style={{
                  backgroundColor: piece.color,
                  borderRadius: 2,
                  height: piece.size,
                  left: piece.leftRatio * windowWidth,
                  opacity,
                  position: "absolute",
                  top: 80,
                  transform: [{ translateX }, { translateY }, { rotate }],
                  width: piece.size * 0.62,
                }}
              />
            );
          })}
        </View>
      )}

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
