import { MaterialIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  useDailyProgressStore,
  useTaskCompletion,
} from "../progress/daily-progress-store";
import { getDateKey } from "../reading/reading-plan-utils";
import { useAppearanceStore } from "../settings/appearance-store";
import {
  REQUIRED_CORRECT_STREAK,
  useVocabularyNotebookStore,
  type VocabularyNotebookWord,
} from "./vocabulary-notebook-store";

type NotebookMode = "screening" | "library" | "study";
type VocabularyAnswer = "correct" | "wrong";

const WORD_SPEECH_RATE = 0.82;

type NotebookColors = {
  accent: string;
  background: string;
  border: string;
  card: string;
  cardMuted: string;
  muted: string;
  primaryButton: string;
  primaryButtonText: string;
  success: string;
  text: string;
  textSecondary: string;
};

const getNotebookColors = (darkModeEnabled: boolean): NotebookColors => ({
  accent: darkModeEnabled ? "#9bdcff" : "#0a7ea4",
  background: darkModeEnabled ? "#0c0c0c" : "#fff",
  border: darkModeEnabled ? "#303030" : "#e4e4e4",
  card: darkModeEnabled ? "#171717" : "#fff",
  cardMuted: darkModeEnabled ? "#111" : "#f7f7f7",
  muted: darkModeEnabled ? "#8f8f8f" : "#777",
  primaryButton: darkModeEnabled ? "#f5f5f5" : "#111",
  primaryButtonText: darkModeEnabled ? "#111" : "#fff",
  success: "#2db65a",
  text: darkModeEnabled ? "#f5f5f5" : "#111",
  textSecondary: darkModeEnabled ? "#c9c9c9" : "#444",
});

const getModeLabel = (mode: NotebookMode) => {
  if (mode === "screening") {
    return "Review";
  }

  if (mode === "library") {
    return "Vocabulary";
  }

  return "Practice";
};

const getModeCount = (
  mode: NotebookMode,
  screeningCount: number,
  learningCount: number,
) => {
  if (mode === "screening") {
    return screeningCount;
  }

  return learningCount;
};

function Metric({
  label,
  value,
  colors,
}: {
  colors: NotebookColors;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.cardMuted,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        minWidth: 96,
        padding: 12,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: 22,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 12,
          fontWeight: "700",
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function EmptyState({
  colors,
  icon,
  text,
  title,
}: {
  colors: NotebookColors;
  icon: keyof typeof MaterialIcons.glyphMap;
  text: string;
  title: string;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.cardMuted,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 8,
        borderWidth: 1,
        gap: 8,
        padding: 22,
      }}
    >
      <MaterialIcons name={icon} size={30} color={colors.muted} />
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>
        {title}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function ScreeningWordCard({
  colors,
  onKeep,
  onRemove,
  word,
}: {
  colors: NotebookColors;
  onKeep: () => void;
  onRemove: () => void;
  word: VocabularyNotebookWord;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 8,
        borderWidth: 1,
        gap: 10,
        padding: 14,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.text, fontSize: 21, fontWeight: "800" }}>
          {word.term}
        </Text>
        <Text
          selectable
          style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22 }}
        >
          {word.definition}
        </Text>
        {!!word.sourceLabel && (
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            {word.sourceLabel}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onKeep}
          style={{
            alignItems: "center",
            backgroundColor: colors.primaryButton,
            borderCurve: "continuous",
            borderRadius: 18,
            flexDirection: "row",
            gap: 6,
            minHeight: 38,
            paddingHorizontal: 12,
          }}
        >
          <MaterialIcons name="add-card" size={18} color={colors.primaryButtonText} />
          <Text
            style={{
              color: colors.primaryButtonText,
              fontSize: 14,
              fontWeight: "800",
            }}
          >
            Keep for practice
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onRemove}
          style={{
            alignItems: "center",
            backgroundColor: colors.cardMuted,
            borderColor: colors.border,
            borderCurve: "continuous",
            borderRadius: 18,
            borderWidth: 1,
            flexDirection: "row",
            gap: 6,
            minHeight: 38,
            paddingHorizontal: 12,
          }}
        >
          <MaterialIcons name="check-circle" size={18} color={colors.success} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
            Already known
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function LibraryWordCard({
  colors,
  onRemove,
  onStudy,
  word,
}: {
  colors: NotebookColors;
  onRemove: () => void;
  onStudy: () => void;
  word: VocabularyNotebookWord;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 8,
        borderWidth: 1,
        gap: 10,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
            {word.term}
          </Text>
          <Text
            selectable
            style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}
          >
            {word.definition}
          </Text>
        </View>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.cardMuted,
            borderRadius: 8,
            justifyContent: "center",
            minWidth: 56,
            padding: 8,
          }}
        >
          <Text
            style={{
              color: colors.accent,
              fontSize: 18,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {word.correctStreak}/{REQUIRED_CORRECT_STREAK}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
            streak
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onStudy}
          style={{
            alignItems: "center",
            backgroundColor: colors.primaryButton,
            borderCurve: "continuous",
            borderRadius: 18,
            flexDirection: "row",
            gap: 6,
            minHeight: 36,
            paddingHorizontal: 12,
          }}
        >
          <MaterialIcons name="school" size={17} color={colors.primaryButtonText} />
          <Text
            style={{
              color: colors.primaryButtonText,
              fontSize: 13,
              fontWeight: "800",
            }}
          >
            Practice
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onRemove}
          style={{
            alignItems: "center",
            backgroundColor: colors.cardMuted,
            borderColor: colors.border,
            borderCurve: "continuous",
            borderRadius: 18,
            borderWidth: 1,
            flexDirection: "row",
            gap: 6,
            minHeight: 36,
            paddingHorizontal: 12,
          }}
        >
          <MaterialIcons name="delete-outline" size={17} color={colors.muted} />
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
            Remove
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function VocabularyNotebookScreen() {
  const currentDate = useMemo(() => new Date(), []);
  const dateKey = getDateKey(currentDate);
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
  const words = useVocabularyNotebookStore((state) => state.words);
  const keepForStudy = useVocabularyNotebookStore((state) => state.keepForStudy);
  const knownWordIds = useVocabularyNotebookStore((state) => state.knownWordIds);
  const markCorrect = useVocabularyNotebookStore((state) => state.markCorrect);
  const markKnown = useVocabularyNotebookStore((state) => state.markKnown);
  const removeWord = useVocabularyNotebookStore((state) => state.removeWord);
  const resetStreak = useVocabularyNotebookStore((state) => state.resetStreak);
  const completeTask = useDailyProgressStore((state) => state.completeTask);
  const vocabularyCompleted = useTaskCompletion(dateKey, "vocabulary");
  const [mode, setMode] = useState<NotebookMode>("screening");
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyQueueIds, setStudyQueueIds] = useState<string[]>([]);
  const [isStudySessionComplete, setIsStudySessionComplete] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const colors = getNotebookColors(darkModeEnabled);
  const screeningWords = useMemo(
    () => words.filter((word) => word.status === "screening"),
    [words],
  );
  const learningWords = useMemo(
    () => words.filter((word) => word.status === "learning"),
    [words],
  );
  const learningWordsById = useMemo(
    () => new Map(learningWords.map((word) => [word.id, word])),
    [learningWords],
  );
  const currentStudyWord = studyQueueIds.length
    ? (learningWordsById.get(studyQueueIds[studyIndex]) ?? null)
    : null;
  const knownWordsCount = Object.keys(knownWordIds).length;

  // Adjust the session before rendering when the available queue changes.
  if (mode === "study") {
    if (!studyQueueIds.length && learningWords.length && !isStudySessionComplete) {
      setStudyQueueIds(learningWords.map((word) => word.id));
      setStudyIndex(0);
      setIsFlipped(false);
    } else if (studyIndex > Math.max(studyQueueIds.length - 1, 0)) {
      setStudyIndex(Math.max(studyQueueIds.length - 1, 0));
      setIsFlipped(false);
    }
  }

  useEffect(
    () => () => {
      Speech.stop();
    },
    [],
  );

  const handleKeepAll = () => {
    for (const word of screeningWords) {
      keepForStudy(word.id);
    }

    setMode("library");
  };

  const startStudySession = (startWordId?: string) => {
    const wordIds = learningWords.map((word) => word.id);
    const queue =
      startWordId && wordIds.includes(startWordId)
        ? [startWordId, ...wordIds.filter((wordId) => wordId !== startWordId)]
        : wordIds;

    setStudyQueueIds(queue);
    setStudyIndex(0);
    setIsStudySessionComplete(false);
    setIsFlipped(false);
    setMode("study");
  };

  const handleStudyWord = (wordId: string) => {
    startStudySession(wordId);
  };

  const handleAnswer = (answer: VocabularyAnswer) => {
    if (!currentStudyWord) {
      return;
    }

    if (answer === "correct") {
      markCorrect(currentStudyWord.id);
    } else {
      resetStreak(currentStudyWord.id);
    }

    setIsFlipped(false);

    if (studyIndex >= studyQueueIds.length - 1) {
      setIsStudySessionComplete(true);
      return;
    }

    setStudyIndex((index) => index + 1);
  };

  const handleCompleteVocabularyReview = () => {
    completeTask(dateKey, "vocabulary");
  };

  const handleSpeakWord = (word: string) => {
    Speech.stop();
    Speech.speak(word, {
      language: "en-US",
      pitch: 1,
      rate: WORD_SPEECH_RATE,
    });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        alignSelf: "center",
        gap: 20,
        maxWidth: 1000,
        paddingBottom: 110,
        paddingHorizontal: 20,
        paddingTop: 72,
        width: "100%",
      }}
    >
      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: colors.muted,
            fontSize: 14,
            fontWeight: "700",
          }}
        >
          AI Vocabulary
        </Text>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
          Vocabulary
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 23,
          }}
        >
          Filter out familiar words, then practice with flashcards until you get each word right 7 times in a row.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Metric
          colors={colors}
          label="To review"
          value={String(screeningWords.length)}
        />
        <Metric
          colors={colors}
          label="Learning"
          value={String(learningWords.length)}
        />
        <Metric
          colors={colors}
          label="Mastered"
          value={String(knownWordsCount)}
        />
      </View>

      <View
        style={{
          backgroundColor: colors.cardMuted,
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: 20,
          borderWidth: 1,
          flexDirection: "row",
          gap: 4,
          padding: 4,
        }}
      >
        {(["screening", "library", "study"] as NotebookMode[]).map((item) => {
          const isActive = mode === item;
          const count = getModeCount(
            item,
            screeningWords.length,
            learningWords.length,
          );

          return (
            <Pressable
              accessibilityRole="button"
              key={item}
              onPress={() => {
                if (item === "study") {
                  startStudySession();
                  return;
                }

                setMode(item);
                setIsFlipped(false);
              }}
              style={{
                alignItems: "center",
                backgroundColor: isActive ? colors.card : "transparent",
                borderCurve: "continuous",
                borderRadius: 16,
                flex: 1,
                justifyContent: "center",
                minHeight: 38,
              }}
            >
              <Text
                style={{
                  color: isActive ? colors.text : colors.muted,
                  fontSize: 14,
                  fontWeight: "800",
                }}
              >
                {getModeLabel(item)} {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === "screening" && (
        <View style={{ gap: 12 }}>
          {screeningWords.length > 1 && (
            <Pressable
              accessibilityRole="button"
              onPress={handleKeepAll}
              style={{
                alignItems: "center",
                backgroundColor: colors.primaryButton,
                borderCurve: "continuous",
                borderRadius: 18,
                flexDirection: "row",
                gap: 6,
                justifyContent: "center",
                minHeight: 44,
                paddingHorizontal: 14,
              }}
            >
              <MaterialIcons
                name="playlist-add-check"
                size={20}
                color={colors.primaryButtonText}
              />
              <Text
                style={{
                  color: colors.primaryButtonText,
                  fontSize: 15,
                  fontWeight: "800",
                }}
              >
                Keep all for practice
              </Text>
            </Pressable>
          )}

          {screeningWords.length ? (
            screeningWords.map((word) => (
              <ScreeningWordCard
                colors={colors}
                key={word.id}
                onKeep={() => keepForStudy(word.id)}
                onRemove={() => markKnown(word.id)}
                word={word}
              />
            ))
          ) : (
            <EmptyState
              colors={colors}
              icon="filter-alt"
              title="No words to review"
              text="Analyze vocabulary on the Reading page, then add words here."
            />
          )}
        </View>
      )}

      {mode === "library" && (
        <View style={{ gap: 12 }}>
          {learningWords.length ? (
            learningWords.map((word) => (
              <LibraryWordCard
                colors={colors}
                key={word.id}
                onRemove={() => removeWord(word.id)}
                onStudy={() => handleStudyWord(word.id)}
                word={word}
              />
            ))
          ) : (
            <EmptyState
              colors={colors}
              icon="menu-book"
              title="Your notebook is empty"
              text="Words you keep after review will appear here."
            />
          )}
        </View>
      )}

      {mode === "study" && (
        <View style={{ gap: 14 }}>
          {isStudySessionComplete ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleCompleteVocabularyReview}
              style={{
                alignItems: "center",
                backgroundColor: vocabularyCompleted
                  ? darkModeEnabled
                    ? "#112319"
                    : "#f1f8f4"
                  : colors.primaryButton,
                borderColor: vocabularyCompleted
                  ? darkModeEnabled
                    ? "#2f6d43"
                    : "#9bd8ad"
                  : colors.primaryButton,
                borderCurve: "continuous",
                borderRadius: 8,
                borderWidth: 1,
                gap: 12,
                justifyContent: "center",
                minHeight: 230,
                padding: 24,
              }}
            >
              <MaterialIcons
                name={vocabularyCompleted ? "check-circle" : "task-alt"}
                size={42}
                color={
                  vocabularyCompleted ? "#2db65a" : colors.primaryButtonText
                }
              />
              <Text
                style={{
                  color: vocabularyCompleted
                    ? "#2db65a"
                    : colors.primaryButtonText,
                  fontSize: 22,
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                {vocabularyCompleted
                  ? "Today's practice is complete"
                  : "Complete today's practice"}
              </Text>
              <Text
                style={{
                  color: vocabularyCompleted
                    ? "#2db65a"
                    : colors.primaryButtonText,
                  fontSize: 14,
                  fontWeight: "700",
                  lineHeight: 20,
                  opacity: 0.86,
                  textAlign: "center",
                }}
              >
                You have practiced every word in this round.
              </Text>
            </Pressable>
          ) : currentStudyWord ? (
            <>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderCurve: "continuous",
                  borderRadius: 8,
                  borderWidth: 1,
                  gap: 12,
                  minHeight: 260,
                  padding: 22,
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 13,
                      fontWeight: "800",
                    }}
                  >
                    {isFlipped ? "Definition" : "Guess the meaning"}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Pronounce ${currentStudyWord.term}`}
                    accessibilityRole="button"
                    onPress={() => handleSpeakWord(currentStudyWord.term)}
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                      borderCurve: "continuous",
                      borderRadius: 18,
                      borderWidth: 1,
                      height: 36,
                      justifyContent: "center",
                      width: 36,
                    }}
                  >
                    <MaterialIcons
                      name="volume-up"
                      size={20}
                      color={colors.text}
                    />
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsFlipped((value) => !value)}
                  style={{
                    alignItems: "center",
                    flex: 1,
                    justifyContent: "center",
                    minHeight: 168,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: colors.text,
                      fontSize: isFlipped ? 24 : 34,
                      fontWeight: "800",
                      lineHeight: isFlipped ? 34 : 42,
                      textAlign: "center",
                    }}
                  >
                    {isFlipped
                      ? currentStudyWord.definition
                      : currentStudyWord.term}
                  </Text>
                </Pressable>

                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 13,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  {currentStudyWord.correctStreak}/{REQUIRED_CORRECT_STREAK} ·
                  Tap the card to reveal
                </Text>
              </View>

              {isFlipped && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleAnswer("wrong")}
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                      borderCurve: "continuous",
                      borderRadius: 18,
                      borderWidth: 1,
                      flex: 1,
                      flexDirection: "row",
                      gap: 8,
                      justifyContent: "center",
                      minHeight: 48,
                      paddingHorizontal: 16,
                    }}
                  >
                    <MaterialIcons
                      name="cancel"
                      size={20}
                      color={colors.muted}
                    />
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: "800",
                      }}
                    >
                      Got it wrong
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleAnswer("correct")}
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.success,
                      borderCurve: "continuous",
                      borderRadius: 18,
                      flex: 1,
                      flexDirection: "row",
                      gap: 8,
                      justifyContent: "center",
                      minHeight: 48,
                      paddingHorizontal: 16,
                    }}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color="#fff"
                    />
                    <Text
                      style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}
                    >
                      Got it right
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <EmptyState
              colors={colors}
              icon="school"
              title="No words to practice"
              text="Keep a few words during review, then start practicing."
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}
