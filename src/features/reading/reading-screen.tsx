import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
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
import { getScriptureText } from "../../data/bible";
import {
  CompletionCelebrationOverlay,
  useCompletionCelebration,
} from "../progress/completion-celebration";
import {
  useDailyProgressStore,
  useTaskCompletion,
} from "../progress/daily-progress-store";
import { useAppearanceStore } from "../settings/appearance-store";
import {
  addDays,
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

type VocabularyItem = {
  definition: string;
  term: string;
};

type VocabularyMap = Record<string, VocabularyItem[]>;

type VocabularyResponse = {
  error?: string;
  results?: {
    id: string;
    terms: VocabularyItem[];
  }[];
};

type PlaybackStatus = "idle" | "playing" | "paused";
type SentenceTranslation =
  | { status: "loading" }
  | { status: "success"; text: string }
  | { message: string; status: "error" };
type SentenceTranslationMap = Record<string, SentenceTranslation>;
type SentenceLongPressHandler = (sentenceId: string, text: string) => void;
type WordPressHandler = (word: string) => void;

const FONT = 20;
const LINE_HEIGHT = 30;
const DOUBLE_PRESS_DELAY = 350;
const MIN_SPEECH_RATE = 0.6;
const MAX_SPEECH_RATE = 1.4;
const SPEECH_RATE_STEP = 0.1;
const WORD_SPEECH_RATE = 0.85;
const WORD_PRONUNCIATION_HINT =
  process.env.EXPO_OS === "web"
    ? "Double-click any English word to hear it."
    : "Double-tap any English word to hear it.";
const SENTENCE_TRANSLATION_HINT =
  "Press and hold any sentence for a Chinese translation.";
const TARGET_LANGUAGE = "zh-CN";
const TRANSLATE_PATH = "/api/translate";
const VOCABULARY_PATH = "/api/vocabulary";
const HEADER_EXPANDED_HEIGHT = 112;
const HEADER_COMPACT_HEIGHT = 80;
const HEADER_COLLAPSE_DISTANCE = 72;
const TRANSLATE_API_ORIGIN = (
  process.env.EXPO_PUBLIC_TRANSLATE_API_ORIGIN ?? ""
).replace(/\/$/, "");
const TRANSLATE_ENDPOINT = TRANSLATE_API_ORIGIN
  ? `${TRANSLATE_API_ORIGIN}${TRANSLATE_PATH}`
  : TRANSLATE_PATH;
const VOCABULARY_ENDPOINT = TRANSLATE_API_ORIGIN
  ? `${TRANSLATE_API_ORIGIN}${VOCABULARY_PATH}`
  : VOCABULARY_PATH;
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

const safeText = (text: unknown) => (typeof text === "string" ? text : "");

const normalizeText = (text?: unknown) =>
  safeText(text).replace(/\s+/g, " ").trim();

const ENGLISH_WORD_PATTERN = /([A-Za-z]+(?:[’'-][A-Za-z]+)*)/g;
const ENGLISH_WORD_PART_PATTERN = /^[A-Za-z]+(?:[’'-][A-Za-z]+)*$/;

const renderPronounceableText = (
  text: string,
  onWordPress: WordPressHandler,
  onLongPress?: () => void,
) =>
  text.split(ENGLISH_WORD_PATTERN).map((part, index) => {
    if (!ENGLISH_WORD_PART_PATTERN.test(part)) {
      return part;
    }

    return (
      <Text
        key={`${part}:${index}`}
        onLongPress={onLongPress}
        onPress={() => onWordPress(part)}
        suppressHighlighting={Boolean(onLongPress)}
      >
        {part}
      </Text>
    );
  });

const formatHeaderDate = (date: Date) => HEADER_MONTH_FORMATTER.format(date);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getVocabularyPattern = (items: VocabularyItem[]) => {
  const terms = items
    .map((item) => item.term.trim())
    .filter(Boolean)
    .sort((first, second) => second.length - first.length);

  if (!terms.length) {
    return null;
  }

  return new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
};

const renderTextWithVocabulary = (
  text: string,
  items: VocabularyItem[],
  annotationColor: string,
  onWordPress: WordPressHandler,
  onLongPress?: () => void,
) => {
  const pattern = getVocabularyPattern(items);

  if (!pattern) {
    return renderPronounceableText(text, onWordPress, onLongPress);
  }

  const definitionsByTerm = new Map(
    items.map((item) => [item.term.trim().toLowerCase(), item.definition]),
  );
  const parts = text.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    const definition = definitionsByTerm.get(part.toLowerCase());

    if (!definition) {
      return renderPronounceableText(part, onWordPress, onLongPress);
    }

    return (
      <Text
        key={`${part}:${index}`}
        onLongPress={onLongPress}
        style={{ color: annotationColor }}
      >
        {renderPronounceableText(part, onWordPress, onLongPress)} ({definition})
      </Text>
    );
  });
};

type SentenceSegment = {
  text: string;
  trailingWhitespace: string;
};

const splitIntoSentences = (text: string): SentenceSegment[] => {
  const segments: SentenceSegment[] = [];
  let sentenceStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (!".!?".includes(text[index])) {
      continue;
    }

    let sentenceEnd = index + 1;

    while (
      sentenceEnd < text.length &&
      "\"'’”)]".includes(text[sentenceEnd])
    ) {
      sentenceEnd += 1;
    }

    if (sentenceEnd < text.length && !/\s/.test(text[sentenceEnd])) {
      continue;
    }

    let nextSentenceStart = sentenceEnd;

    while (
      nextSentenceStart < text.length &&
      /\s/.test(text[nextSentenceStart])
    ) {
      nextSentenceStart += 1;
    }

    segments.push({
      text: text.slice(sentenceStart, sentenceEnd),
      trailingWhitespace: text.slice(sentenceEnd, nextSentenceStart),
    });
    sentenceStart = nextSentenceStart;
    index = nextSentenceStart - 1;
  }

  if (sentenceStart < text.length) {
    const remainingText = text.slice(sentenceStart);
    const trailingWhitespace = remainingText.match(/\s*$/)?.[0] ?? "";

    segments.push({
      text: remainingText.slice(
        0,
        remainingText.length - trailingWhitespace.length,
      ),
      trailingWhitespace,
    });
  }

  return segments.filter((segment) => segment.text);
};

const renderInteractiveSentences = ({
  annotationColor,
  chunkId,
  enabled,
  errorColor,
  loadingColor,
  onSentenceLongPress,
  onWordPress,
  sentenceTranslations,
  text,
  translationColor,
  vocabularyItems,
}: {
  annotationColor: string;
  chunkId: string;
  enabled: boolean;
  errorColor: string;
  loadingColor: string;
  onSentenceLongPress: SentenceLongPressHandler;
  onWordPress: WordPressHandler;
  sentenceTranslations: SentenceTranslationMap;
  text: string;
  translationColor: string;
  vocabularyItems: VocabularyItem[];
}) => {
  if (!enabled) {
    return renderPronounceableText(text, onWordPress);
  }

  return splitIntoSentences(text).map((sentence, index) => {
    const sentenceId = `${chunkId}.sentence.${index}`;
    const translation = sentenceTranslations[sentenceId];
    const handleLongPress = () =>
      onSentenceLongPress(sentenceId, sentence.text);

    return (
      <Text
        key={sentenceId}
        onLongPress={handleLongPress}
        suppressHighlighting
      >
        {renderTextWithVocabulary(
          sentence.text,
          vocabularyItems,
          annotationColor,
          onWordPress,
          handleLongPress,
        )}
        {translation?.status === "loading" && (
          <Text style={{ color: loadingColor }}> 〔Translating…〕</Text>
        )}
        {translation?.status === "success" && (
          <Text style={{ color: translationColor }}>
            {" "}
            〔{translation.text}〕
          </Text>
        )}
        {translation?.status === "error" && (
          <Text style={{ color: errorColor }}>
            {" "}
            〔{translation.message} Long-press to retry.〕
          </Text>
        )}
        {sentence.trailingWhitespace}
      </Text>
    );
  });
};

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

const buildVocabularyChunks = (day: Day): TranslationChunk[] =>
  [
    { id: getDayIntroductionId(), text: safeText(day.introduction) },
    ...getSections(day).flatMap((section, sectionIndex) => [
      {
        id: getSectionIntroductionId(sectionIndex),
        text: safeText(section.introduction),
      },
      ...getParagraphs(section).map((paragraph, paragraphIndex) => ({
        id: getParagraphScriptureId(sectionIndex, paragraphIndex),
        text: getParagraphScripture(paragraph),
      })),
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
  signal?: AbortSignal,
): Promise<TranslationMap> => {
  const response = await fetch(TRANSLATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetLanguage: TARGET_LANGUAGE,
      chunks,
    }),
    signal,
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

const analyzeVocabulary = async (
  chunks: TranslationChunk[],
): Promise<VocabularyMap> => {
  const response = await fetch(VOCABULARY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chunks }),
  });
  const data = await parseTranslationResponse(response);
  const vocabularyData = data as VocabularyResponse;

  if (!response.ok) {
    throw new Error(
      vocabularyData.error || `Vocabulary analysis failed: ${response.status}`,
    );
  }

  return Object.fromEntries(
    (vocabularyData.results ?? []).map((result) => [
      result.id,
      result.terms ?? [],
    ]),
  );
};

const clampSpeechRate = (rate: number) =>
  Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));

const getCompleteButtonLabel = (
  isCompleted: boolean,
  isSelectedToday: boolean,
) => {
  if (isCompleted) {
    return isSelectedToday
      ? "Today's reading is complete"
      : "This reading is complete";
  }

  return isSelectedToday
    ? "Complete Today's Reading"
    : "Mark This Reading Complete";
};

const getCompletionMessage = (isSelectedToday: boolean) =>
  isSelectedToday
    ? "Come back tomorrow. A little each day is enough."
    : "You're caught up on this day. Keep going.";

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

export default function ReadingScreen() {
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
  const vocabularyChunks = useMemo(
    () => buildVocabularyChunks(selectedDay),
    [selectedDay],
  );
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [sentenceTranslations, setSentenceTranslations] =
    useState<SentenceTranslationMap>({});
  const [vocabulary, setVocabulary] = useState<VocabularyMap>({});
  const [isVocabularyVisible, setIsVocabularyVisible] = useState(false);
  const [isAnalyzingVocabulary, setIsAnalyzingVocabulary] = useState(false);
  const [vocabularyError, setVocabularyError] = useState<string | null>(null);
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
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
  const lastWordPressRef = useRef<{
    normalizedWord: string;
    timestamp: number;
  } | null>(null);
  const sentenceTranslationsRef = useRef<SentenceTranslationMap>({});
  const sentenceTranslationControllersRef = useRef(
    new Map<string, AbortController>(),
  );

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
      sentenceTranslationControllersRef.current.forEach((controller) =>
        controller.abort(),
      );
      sentenceTranslationControllersRef.current.clear();
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
    sentenceTranslationControllersRef.current.forEach((controller) =>
      controller.abort(),
    );
    sentenceTranslationControllersRef.current.clear();
    sentenceTranslationsRef.current = {};
    setSentenceTranslations({});
    setVocabulary({});
    setIsVocabularyVisible(false);
    setIsAnalyzingVocabulary(false);
    setVocabularyError(null);
    lastWordPressRef.current = null;
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.value = 0;
  }, [scrollY, selectedDayOfYear, stopSpeechPlayback]);

  const pronounceWord = useCallback((word: string) => {
    const runId = playbackRunRef.current + 1;

    playbackRunRef.current = runId;
    isPausedInEngineRef.current = false;
    speechChunksRef.current = [];
    currentSpeechIndexRef.current = 0;
    setPlaybackStatus("idle");
    setIsPlayerVisible(false);
    setCurrentSpeechIndex(0);

    void Speech.stop().finally(() => {
      if (runId !== playbackRunRef.current) {
        return;
      }

      Speech.speak(word, {
        language: "en-US",
        pitch: 1,
        rate: WORD_SPEECH_RATE,
      });
    });
  }, []);

  const handleWordPress = useCallback(
    (word: string) => {
      const timestamp = Date.now();
      const normalizedWord = word.toLocaleLowerCase("en-US");
      const lastPress = lastWordPressRef.current;

      if (
        lastPress?.normalizedWord === normalizedWord &&
        timestamp - lastPress.timestamp <= DOUBLE_PRESS_DELAY
      ) {
        lastWordPressRef.current = null;
        pronounceWord(word);
        return;
      }

      lastWordPressRef.current = { normalizedWord, timestamp };
    },
    [pronounceWord],
  );

  const updateSentenceTranslation = useCallback(
    (sentenceId: string, translation: SentenceTranslation) => {
      const nextTranslations = {
        ...sentenceTranslationsRef.current,
        [sentenceId]: translation,
      };

      sentenceTranslationsRef.current = nextTranslations;
      setSentenceTranslations(nextTranslations);
    },
    [],
  );

  const handleSentenceLongPress = useCallback(
    async (sentenceId: string, text: string) => {
      const currentTranslation = sentenceTranslationsRef.current[sentenceId];

      if (
        currentTranslation?.status === "loading" ||
        currentTranslation?.status === "success"
      ) {
        return;
      }

      const sentence = normalizeText(text);

      if (!sentence) {
        return;
      }

      if (process.env.EXPO_OS === "ios") {
        void Haptics.selectionAsync();
      }

      sentenceTranslationControllersRef.current
        .get(sentenceId)
        ?.abort();

      const controller = new AbortController();

      sentenceTranslationControllersRef.current.set(sentenceId, controller);
      updateSentenceTranslation(sentenceId, { status: "loading" });

      try {
        const translatedChunks = await translateChunks(
          [{ id: sentenceId, text: sentence }],
          controller.signal,
        );

        if (controller.signal.aborted) {
          return;
        }

        updateSentenceTranslation(sentenceId, {
          status: "success",
          text: translatedChunks[sentenceId] ?? sentence,
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }

        updateSentenceTranslation(sentenceId, {
          message:
            error instanceof Error ? error.message : "Translation failed.",
          status: "error",
        });
      } finally {
        if (
          sentenceTranslationControllersRef.current.get(sentenceId) ===
          controller
        ) {
          sentenceTranslationControllersRef.current.delete(sentenceId);
        }
      }
    },
    [updateSentenceTranslation],
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

  const handleAnalyzeVocabulary = async () => {
    if (isVocabularyVisible) {
      setIsVocabularyVisible(false);
      return;
    }

    if (Object.keys(vocabulary).length) {
      setIsVocabularyVisible(true);
      return;
    }

    if (!vocabularyChunks.length) {
      return;
    }

    setIsAnalyzingVocabulary(true);
    setVocabularyError(null);

    try {
      const analyzedVocabulary = await analyzeVocabulary(vocabularyChunks);

      setVocabulary(analyzedVocabulary);
      setIsVocabularyVisible(true);
    } catch (error) {
      setVocabularyError(
        error instanceof Error ? error.message : "Vocabulary analysis failed.",
      );
    } finally {
      setIsAnalyzingVocabulary(false);
    }
  };

  const dateString = formatHeaderDate(selectedDate);
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
  const colors = {
    annotation: darkModeEnabled ? "#78d893" : "#1f7a3a",
    background: darkModeEnabled ? "#0c0c0c" : "#fff",
    border: darkModeEnabled ? "#303030" : "#ddd",
    chip: darkModeEnabled ? "#242424" : "#E7E7E7",
    intro: darkModeEnabled ? "#1e1e1e" : "#ececec",
    label: darkModeEnabled ? "#a5a5a5" : "#666",
    playerText: darkModeEnabled ? "#f5f5f5" : "#111",
    text: darkModeEnabled ? "#f5f5f5" : "#111",
    textSecondary: darkModeEnabled ? "#c9c9c9" : "#333",
  };
  const headerIconColor = darkModeEnabled
    ? "rgba(245, 245, 245, 0.86)"
    : "rgba(17, 17, 17, 0.82)";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View
        style={[
          {
            borderBottomWidth: 0.5,
            borderColor: colors.border,
            backgroundColor: colors.background,
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
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Pressable
              accessibilityLabel="View previous reading"
              accessibilityRole="button"
              disabled={!canGoPreviousDay}
              onPress={handlePreviousDay}
              style={{
                width: 27,
                height: 31,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.chip,
                borderTopLeftRadius: 28,
                borderBottomLeftRadius: 28,
                opacity: canGoPreviousDay ? 1 : 0.26,
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
                minWidth: 108,
                backgroundColor: colors.chip,
                justifyContent: "center",
                alignItems: "center",
                marginHorizontal: 2,
                height: 31,
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
              accessibilityLabel="View next reading"
              accessibilityRole="button"
              disabled={!canGoNextDay}
              onPress={handleNextDay}
              style={{
                width: 27,
                height: 31,
                backgroundColor: colors.chip,
                borderTopRightRadius: 28,
                borderBottomRightRadius: 28,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons
                name="chevron-right"
                size={25}
                color={colors.text}
                style={{ opacity: canGoNextDay ? 1 : 0.26 }}
              />
            </Pressable>
          </View>

          <View
            style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}
          >
            <Pressable
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
              accessibilityLabel="Analyze difficult vocabulary"
              accessibilityRole="button"
              disabled={isAnalyzingVocabulary}
              onPress={handleAnalyzeVocabulary}
              style={getHeaderToolStyle(isAnalyzingVocabulary)}
            >
              <MaterialIcons
                name="school"
                size={23}
                color={isVocabularyVisible ? "#2db65a" : headerIconColor}
              />
            </Pressable>

            <Pressable
              accessibilityLabel="Start reading aloud"
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
            {dateString} | NIV
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        onScroll={handleReadingScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          alignSelf: "center",
          maxWidth: 1000,
          paddingBottom: isPlayerVisible ? PLAYER_SCROLL_PADDING : 80,
          paddingHorizontal: 20,
          paddingTop: 20,
          width: "100%",
        }}
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

        {!!vocabularyError && (
          <Text
            style={{
              color: darkModeEnabled ? "#ff8a8a" : "#b00020",
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 12,
            }}
          >
            {vocabularyError}
          </Text>
        )}

        {!!dayTitle.trim() && (
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
            {renderPronounceableText(dayTitle, handleWordPress)}
          </Text>
        )}

        <View
          style={{
            gap: 4,
            marginTop: 8,
          }}
        >
          <View
            style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
          >
            <MaterialIcons name="volume-up" size={16} color={colors.label} />
            <Text
              style={{
                color: colors.label,
                flex: 1,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {WORD_PRONUNCIATION_HINT}
            </Text>
          </View>

          <View
            style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
          >
            <MaterialIcons name="translate" size={16} color={colors.label} />
            <Text
              style={{
                color: colors.label,
                flex: 1,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {SENTENCE_TRANSLATION_HINT}
            </Text>
          </View>
        </View>

        {!!dayIntroduction.trim() && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: colors.intro,
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
                color: colors.textSecondary,
              }}
            >
              {renderInteractiveSentences({
                annotationColor: colors.annotation,
                chunkId: getDayIntroductionId(),
                enabled: !isTranslated,
                errorColor: darkModeEnabled ? "#ff8a8a" : "#b00020",
                loadingColor: colors.label,
                onSentenceLongPress: handleSentenceLongPress,
                onWordPress: handleWordPress,
                sentenceTranslations,
                text: dayIntroduction,
                translationColor: colors.annotation,
                vocabularyItems:
                  isVocabularyVisible && !isTranslated
                    ? (vocabulary[getDayIntroductionId()] ?? [])
                    : [],
              })}
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
                        color: colors.text,
                        fontSize: 22,
                        fontWeight: "600",
                        marginBottom: 8,
                      }}
                    >
                      {renderPronounceableText(
                        sectionTitle,
                        handleWordPress,
                      )}
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
                const sectionVocabularyItems =
                  vocabulary[getSectionIntroductionId(sectionIndex)] ?? [];

                return (
                  !!sectionIntroduction.trim() && (
                    <View
                      style={{
                        marginTop: 12,
                        backgroundColor: colors.intro,
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
                          color: colors.textSecondary,
                        }}
                      >
                        {renderInteractiveSentences({
                          annotationColor: colors.annotation,
                          chunkId: getSectionIntroductionId(sectionIndex),
                          enabled: !isTranslated,
                          errorColor: darkModeEnabled ? "#ff8a8a" : "#b00020",
                          loadingColor: colors.label,
                          onSentenceLongPress: handleSentenceLongPress,
                          onWordPress: handleWordPress,
                          sentenceTranslations,
                          text: sectionIntroduction,
                          translationColor: colors.annotation,
                          vocabularyItems:
                            isVocabularyVisible && !isTranslated
                              ? sectionVocabularyItems
                              : [],
                        })}
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
                const vocabularyItems =
                  vocabulary[getParagraphScriptureId(sectionIndex, pIndex)] ??
                  [];

                return (
                  <View key={pIndex} style={{ marginBottom: 18 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: FONT,
                        fontWeight: "500",
                        marginBottom: 6,
                      }}
                    >
                      {renderPronounceableText(
                        paragraphTitle,
                        handleWordPress,
                      )}
                    </Text>

                    <View style={{ marginBottom: 10 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          color: colors.label,
                          marginBottom: 4,
                        }}
                      >
                        {getParagraphReferenceLabel(p)}
                      </Text>

                      <Text
                        style={{
                          color: colors.text,
                          fontSize: FONT,
                          lineHeight: LINE_HEIGHT,
                        }}
                      >
                        {paragraphScripture
                          ? renderInteractiveSentences({
                              annotationColor: colors.annotation,
                              chunkId: getParagraphScriptureId(
                                sectionIndex,
                                pIndex,
                              ),
                              enabled: !isTranslated,
                              errorColor: darkModeEnabled
                                ? "#ff8a8a"
                                : "#b00020",
                              loadingColor: colors.label,
                              onSentenceLongPress: handleSentenceLongPress,
                              onWordPress: handleWordPress,
                              sentenceTranslations,
                              text: paragraphScripture,
                              translationColor: colors.annotation,
                              vocabularyItems:
                                isVocabularyVisible && !isTranslated
                                  ? vocabularyItems
                                  : [],
                            })
                          : "[Text unavailable]"}
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
            bottom: PLAYER_BOTTOM_OFFSET,
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
              borderRadius: PLAYER_RADIUS,
              borderCurve: "continuous",
              borderColor: darkModeEnabled
                ? "rgba(255, 255, 255, 0.16)"
                : "rgba(255, 255, 255, 0.42)",
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
                flexDirection: "row",
                alignItems: "center",
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
                accessibilityLabel="Close reading controls"
                accessibilityRole="button"
                onPress={handleStopPlayback}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
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
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                marginBottom: PLAYER_CONTROLS_BOTTOM_GAP,
                minHeight: PLAYER_PRIMARY_BUTTON_SIZE,
              }}
            >
              <Pressable
                accessibilityLabel="Go back to previous passage"
                accessibilityRole="button"
                onPress={handleSkipBackward}
                style={{
                  ...getGlassIconButtonStyle(darkModeEnabled),
                }}
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
                    ? "Resume reading aloud"
                    : "Pause reading aloud"
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
                  height: PLAYER_PRIMARY_BUTTON_SIZE,
                  justifyContent: "center",
                  boxShadow: "0 8px 18px rgba(0, 0, 0, 0.14)",
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
                accessibilityLabel="Skip to next passage"
                accessibilityRole="button"
                onPress={handleSkipForward}
                style={{
                  ...getGlassIconButtonStyle(darkModeEnabled),
                }}
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
                flexDirection: "row",
                alignItems: "center",
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
                  accessibilityLabel="Decrease reading speed"
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
                  accessibilityLabel="Increase reading speed"
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
