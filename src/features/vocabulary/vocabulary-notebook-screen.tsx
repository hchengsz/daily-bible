import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAppearanceStore } from "../settings/appearance-store";
import {
  REQUIRED_CORRECT_STREAK,
  useVocabularyNotebookStore,
  type VocabularyNotebookWord,
} from "./vocabulary-notebook-store";

type NotebookMode = "screening" | "library" | "study";

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
    return "初筛";
  }

  if (mode === "library") {
    return "单词本";
  }

  return "学习";
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
            留下学习
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
            已熟知
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
            学习
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
            移除
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function VocabularyNotebookScreen() {
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
  const words = useVocabularyNotebookStore((state) => state.words);
  const keepForStudy = useVocabularyNotebookStore((state) => state.keepForStudy);
  const markCorrect = useVocabularyNotebookStore((state) => state.markCorrect);
  const removeWord = useVocabularyNotebookStore((state) => state.removeWord);
  const [mode, setMode] = useState<NotebookMode>("screening");
  const [studyIndex, setStudyIndex] = useState(0);
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
  const currentStudyWord = learningWords[studyIndex] ?? null;

  useEffect(() => {
    if (studyIndex >= learningWords.length) {
      setStudyIndex(Math.max(learningWords.length - 1, 0));
      setIsFlipped(false);
    }
  }, [learningWords.length, studyIndex]);

  const handleKeepAll = () => {
    for (const word of screeningWords) {
      keepForStudy(word.id);
    }

    setMode("library");
  };

  const handleStudyWord = (wordId: string) => {
    const index = learningWords.findIndex((word) => word.id === wordId);

    setStudyIndex(Math.max(index, 0));
    setIsFlipped(false);
    setMode("study");
  };

  const handleCorrect = () => {
    if (!currentStudyWord) {
      return;
    }

    const willGraduate =
      currentStudyWord.correctStreak + 1 >= REQUIRED_CORRECT_STREAK;
    const nextCount = willGraduate
      ? Math.max(learningWords.length - 1, 0)
      : learningWords.length;
    const nextIndex =
      nextCount > 0
        ? willGraduate
          ? studyIndex % nextCount
          : (studyIndex + 1) % nextCount
        : 0;

    markCorrect(currentStudyWord.id);
    setIsFlipped(false);
    setStudyIndex(nextIndex);
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
          单词本
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 23,
          }}
        >
          先筛掉已经熟知的词，再用卡片模式练到连续猜对 7 次。
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Metric
          colors={colors}
          label="待初筛"
          value={String(screeningWords.length)}
        />
        <Metric
          colors={colors}
          label="学习中"
          value={String(learningWords.length)}
        />
        <Metric colors={colors} label="毕业标准" value="7" />
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
                全部留下学习
              </Text>
            </Pressable>
          )}

          {screeningWords.length ? (
            screeningWords.map((word) => (
              <ScreeningWordCard
                colors={colors}
                key={word.id}
                onKeep={() => keepForStudy(word.id)}
                onRemove={() => removeWord(word.id)}
                word={word}
              />
            ))
          ) : (
            <EmptyState
              colors={colors}
              icon="filter-alt"
              title="没有待初筛词汇"
              text="在 Reading 页面完成 AI 难词分析后，可以把词加入这里。"
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
              title="单词本还是空的"
              text="完成初筛后，留下的词会出现在这里。"
            />
          )}
        </View>
      )}

      {mode === "study" && (
        <View style={{ gap: 14 }}>
          {currentStudyWord ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsFlipped((value) => !value)}
                style={{
                  alignItems: "center",
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderCurve: "continuous",
                  borderRadius: 8,
                  borderWidth: 1,
                  justifyContent: "center",
                  minHeight: 260,
                  padding: 22,
                }}
              >
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 13,
                    fontWeight: "800",
                    marginBottom: 12,
                  }}
                >
                  {isFlipped ? "Definition" : "Guess the meaning"}
                </Text>
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
                  {isFlipped ? currentStudyWord.definition : currentStudyWord.term}
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 13,
                    fontWeight: "700",
                    marginTop: 18,
                  }}
                >
                  {currentStudyWord.correctStreak}/{REQUIRED_CORRECT_STREAK} · 点击卡片翻面
                </Text>
              </Pressable>

              {isFlipped && (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleCorrect}
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.success,
                    borderCurve: "continuous",
                    borderRadius: 18,
                    flexDirection: "row",
                    gap: 8,
                    justifyContent: "center",
                    minHeight: 48,
                    paddingHorizontal: 16,
                  }}
                >
                  <MaterialIcons name="check-circle" size={20} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
                    我猜对了
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <EmptyState
              colors={colors}
              icon="school"
              title="没有可学习词汇"
              text="先在初筛中留下几个词，再进入学习模式。"
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}
