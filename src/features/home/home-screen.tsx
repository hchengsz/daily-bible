import { MaterialIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getCatechismDayForDate } from "../catechism/catechism-data";
import {
  useDailyProgressStore,
  useTaskCompletion,
} from "../progress/daily-progress-store";
import { getScriptureText } from "../../data/bible";
import {
  formatDate,
  getDateKey,
  getParagraphReferenceLabel,
  getParagraphs,
  getReadingDayForDate,
  getReadingReferenceSummary,
  getReferences,
  getSections,
  type Day,
  type Paragraph,
} from "../reading/reading-plan-utils";
import { useAppearanceStore } from "../settings/appearance-store";
import { useVocabularyNotebookStore } from "../vocabulary/vocabulary-notebook-store";

type TodoItemProps = {
  completed: boolean;
  darkModeEnabled: boolean;
  description: string;
  href: "/reading" | "/catechism" | "/vocabulary";
  label: string;
  meta: string;
};

const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();

const getParagraphScripture = (paragraph: Paragraph) =>
  getReferences(paragraph)
    .map((reference) =>
      getScriptureText(reference.book, reference.chapter, reference.verse),
    )
    .map((text) => text.trim())
    .filter(Boolean)
    .join(" ");

const buildReadingAloudChunks = (day: Day) =>
  [
    day.title,
    day.introduction,
    ...getSections(day).flatMap((section) => [
      section.title,
      section.introduction,
      ...getParagraphs(section).flatMap((paragraph) => [
        paragraph.title,
        getParagraphReferenceLabel(paragraph),
        getParagraphScripture(paragraph),
      ]),
    ]),
  ]
    .filter((text): text is string => typeof text === "string")
    .map(normalizeText)
    .filter(Boolean);

const buildCatechismAloudChunks = (
  entries: { number: number; text: string }[],
) =>
  entries
    .flatMap((entry) => [
      `CCC ${entry.number}`,
      ...entry.text.split(/\n{2,}/),
    ])
    .map(normalizeText)
    .filter(Boolean);

const getEstimatedReadingMinutes = (
  chunks: { language: "en-US" | "zh-CN"; text: string }[],
) => {
  const minutes = chunks.reduce((total, chunk) => {
    if (chunk.language === "zh-CN") {
      const characterCount = chunk.text.replace(/\s+/g, "").length;

      return total + characterCount / 250;
    }

    const wordCount = chunk.text.split(/\s+/).filter(Boolean).length;

    return total + wordCount / 150;
  }, 0);

  return Math.max(1, Math.ceil(minutes));
};

function TodoItem({
  completed,
  darkModeEnabled,
  description,
  href,
  label,
  meta,
}: TodoItemProps) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        style={{
          backgroundColor: completed
            ? darkModeEnabled
              ? "#112319"
              : "#f4fbf6"
            : darkModeEnabled
              ? "#171717"
              : "#fff",
          borderColor: completed
            ? darkModeEnabled
              ? "#2f6d43"
              : "#a8ddb7"
            : darkModeEnabled
              ? "#303030"
              : "#e2e2e2",
          borderRadius: 8,
          borderWidth: 1,
          gap: 10,
          padding: 16,
        }}
      >
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                color: darkModeEnabled ? "#f5f5f5" : "#111",
                fontSize: 19,
                fontWeight: "700",
              }}
            >
              {label}
            </Text>
            <Text
              style={{
                color: darkModeEnabled ? "#a5a5a5" : "#777",
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {completed ? "Completed" : "To do"} · {meta}
            </Text>
          </View>

          <MaterialIcons
            name={completed ? "check-circle" : "radio-button-unchecked"}
            size={28}
            color={
              completed ? "#2db65a" : darkModeEnabled ? "#737373" : "#9a9a9a"
            }
          />
        </View>

        <Text
          numberOfLines={2}
          style={{
            color: darkModeEnabled ? "#c9c9c9" : "#3f3f3f",
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {description}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const currentDate = useMemo(() => new Date(), []);
  const dateKey = getDateKey(currentDate);
  const readingDay = useMemo(
    () => getReadingDayForDate(currentDate),
    [currentDate],
  );
  const readingReferenceSummary = useMemo(
    () => getReadingReferenceSummary(readingDay),
    [readingDay],
  );
  const catechismDay = useMemo(
    () => getCatechismDayForDate(currentDate),
    [currentDate],
  );
  const catechismReference =
    catechismDay.startNumber === catechismDay.endNumber
      ? `${catechismDay.startNumber}`
      : `${catechismDay.startNumber}-${catechismDay.endNumber}`;
  const vocabularyWords = useVocabularyNotebookStore((state) => state.words);
  const learningVocabularyWords = useMemo(
    () => vocabularyWords.filter((word) => word.status === "learning"),
    [vocabularyWords],
  );
  const readingCompleted = useTaskCompletion(dateKey, "reading");
  const catechismCompleted = useTaskCompletion(dateKey, "catechism");
  const vocabularyCompleted = useTaskCompletion(dateKey, "vocabulary");
  const vocabularyTodoCompleted =
    vocabularyCompleted || learningVocabularyWords.length === 0;
  const totalTodoCount = 3;
  const completedCount =
    Number(readingCompleted) +
    Number(catechismCompleted) +
    Number(vocabularyTodoCompleted);
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
  const setDarkModeEnabled = useAppearanceStore(
    (state) => state.setDarkModeEnabled,
  );
  const completeTask = useDailyProgressStore((state) => state.completeTask);
  const [isReadingAll, setIsReadingAll] = useState(false);
  const readAllRunRef = useRef(0);
  const readAllChunksRef = useRef<
    { language: "en-US" | "zh-CN"; text: string }[]
  >([]);
  const readAllChunks = useMemo(() => {
    const readingChunks = buildReadingAloudChunks(readingDay).map((text) => ({
      language: "en-US" as const,
      text,
    }));
    const catechismChunks = buildCatechismAloudChunks(catechismDay.entries).map(
      (text) => ({
        language: "zh-CN" as const,
        text,
      }),
    );

    return [...readingChunks, ...catechismChunks];
  }, [catechismDay.entries, readingDay]);
  const estimatedReadingMinutes = useMemo(
    () => getEstimatedReadingMinutes(readAllChunks),
    [readAllChunks],
  );

  const stopReadAll = useCallback(() => {
    readAllRunRef.current += 1;
    Speech.stop();
    setIsReadingAll(false);
  }, []);

  useEffect(() => () => stopReadAll(), [stopReadAll]);

  const speakReadAllChunk = useCallback(
    (index: number, runId: number) => {
      const chunk = readAllChunksRef.current[index];

      if (!chunk) {
        if (runId === readAllRunRef.current) {
          completeTask(dateKey, "reading");
          completeTask(dateKey, "catechism");
          setIsReadingAll(false);
        }

        return;
      }

      Speech.speak(chunk.text, {
        language: chunk.language,
        pitch: 1,
        rate: chunk.language === "zh-CN" ? 0.9 : 0.95,
        onDone: () => {
          if (runId !== readAllRunRef.current) {
            return;
          }

          speakReadAllChunk(index + 1, runId);
        },
        onStopped: () => undefined,
      });
    },
    [completeTask, dateKey],
  );

  const handleReadAllToday = useCallback(() => {
    if (isReadingAll) {
      stopReadAll();
      return;
    }

    if (!readAllChunks.length) {
      return;
    }

    readAllRunRef.current += 1;
    const runId = readAllRunRef.current;

    readAllChunksRef.current = readAllChunks;
    setIsReadingAll(true);
    Speech.stop();
    speakReadAllChunk(0, runId);
  }, [
    isReadingAll,
    readAllChunks,
    speakReadAllChunk,
    stopReadAll,
  ]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: darkModeEnabled ? "#0c0c0c" : "#fff" }}
      contentContainerStyle={{
        alignSelf: "center",
        gap: 22,
        maxWidth: 1000,
        paddingBottom: 96,
        paddingHorizontal: 20,
        paddingTop: 72,
        width: "100%",
      }}
    >
      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: darkModeEnabled ? "#a5a5a5" : "#777",
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {formatDate(currentDate)}
        </Text>
        <Text
          style={{
            color: darkModeEnabled ? "#f5f5f5" : "#111",
            fontSize: 30,
            fontWeight: "800",
          }}
        >
          To-do List for Today
        </Text>
        <Text
          style={{
            color: darkModeEnabled ? "#c9c9c9" : "#555",
            fontSize: 16,
            lineHeight: 23,
          }}
        >
          {completedCount === totalTodoCount
            ? "You're all caught up for today."
            : `${totalTodoCount - completedCount} item${
                totalTodoCount - completedCount === 1 ? "" : "s"
              } left for today.`}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <TodoItem
          completed={readingCompleted}
          darkModeEnabled={darkModeEnabled}
          description={
            readingReferenceSummary || "Today's reading is not available yet."
          }
          href="/reading"
          label={readingDay.title || "Daily Reading"}
          meta={`Day ${readingDay.id || ""}`}
        />

        <TodoItem
          completed={catechismCompleted}
          darkModeEnabled={darkModeEnabled}
          description={catechismDay.entries
            .map((entry) => entry.text)
            .join(" ")}
          href="/catechism"
          label="Catechism"
          meta={`CCC ${catechismReference}`}
        />

        <TodoItem
          completed={vocabularyTodoCompleted}
          darkModeEnabled={darkModeEnabled}
          description={
            learningVocabularyWords.length
              ? "Review every saved word once, then mark today's vocabulary practice complete."
              : "No saved words are waiting for review."
          }
          href="/vocabulary"
          label="Vocabulary Review"
          meta={`${learningVocabularyWords.length} word${
            learningVocabularyWords.length === 1 ? "" : "s"
          }`}
        />
      </View>

      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          paddingTop: 2,
        }}
      >
        <Pressable
          accessibilityLabel="Toggle dark mode"
          accessibilityRole="button"
          onPress={() => setDarkModeEnabled(!darkModeEnabled)}
          style={{
            alignItems: "center",
            backgroundColor: darkModeEnabled ? "#171717" : "#f7f7f7",
            borderColor: darkModeEnabled ? "#303030" : "#e7e7e7",
            borderCurve: "continuous",
            borderRadius: 18,
            borderWidth: 1,
            flexDirection: "row",
            gap: 6,
            minHeight: 36,
            paddingHorizontal: 12,
          }}
        >
          <MaterialIcons
            name={darkModeEnabled ? "light-mode" : "dark-mode"}
            size={18}
            color={darkModeEnabled ? "#f5f5f5" : "#111"}
          />
          <Text
            style={{
              color: darkModeEnabled ? "#f5f5f5" : "#111",
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {darkModeEnabled ? "Light mode" : "Dark mode"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel={
            isReadingAll
              ? "Stop reading today's Bible and catechism"
              : "Read today's Bible and catechism aloud"
          }
          accessibilityRole="button"
          onPress={handleReadAllToday}
          style={{
            alignItems: "center",
            backgroundColor: isReadingAll
              ? darkModeEnabled
                ? "#112319"
                : "#f1f8f4"
              : darkModeEnabled
                ? "#171717"
                : "#f7f7f7",
            borderColor: isReadingAll
              ? darkModeEnabled
                ? "#2f6d43"
                : "#9bd8ad"
              : darkModeEnabled
                ? "#303030"
                : "#e7e7e7",
            borderCurve: "continuous",
            borderRadius: 18,
            borderWidth: 1,
            flexDirection: "row",
            gap: 6,
            minHeight: 36,
            paddingHorizontal: 12,
          }}
        >
          <MaterialIcons
            name={isReadingAll ? "stop-circle" : "volume-up"}
            size={18}
            color={
              isReadingAll
                ? "#2db65a"
                : darkModeEnabled
                  ? "#f5f5f5"
                  : "#111"
            }
          />
          <Text
            style={{
              color: isReadingAll
                ? "#2db65a"
                : darkModeEnabled
                  ? "#f5f5f5"
                  : "#111",
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {isReadingAll ? "Stop reading" : "Read today"}
          </Text>
        </Pressable>

        <Text
          selectable
          style={{
            color: darkModeEnabled ? "#a5a5a5" : "#666",
            fontSize: 13,
            fontWeight: "600",
            lineHeight: 18,
          }}
        >
          About {estimatedReadingMinutes} min
        </Text>
      </View>
    </ScrollView>
  );
}
