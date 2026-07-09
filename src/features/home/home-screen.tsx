import { MaterialIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  getCatechismIndexForDate,
  getCatechismItemForDate,
} from "../catechism/catechism-data";
import { useTaskCompletion } from "../progress/daily-progress-store";
import {
  formatDate,
  getDateKey,
  getReadingDayForDate,
  getReadingReferenceSummary,
} from "../reading/reading-plan-utils";
import { useAppearanceStore } from "../settings/appearance-store";

type TodoItemProps = {
  completed: boolean;
  darkModeEnabled: boolean;
  description: string;
  href: "/reading" | "/catechism";
  label: string;
  meta: string;
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
  const catechismIndex = useMemo(
    () => getCatechismIndexForDate(currentDate),
    [currentDate],
  );
  const catechismItem = useMemo(
    () => getCatechismItemForDate(currentDate),
    [currentDate],
  );
  const readingCompleted = useTaskCompletion(dateKey, "reading");
  const catechismCompleted = useTaskCompletion(dateKey, "catechism");
  const completedCount = Number(readingCompleted) + Number(catechismCompleted);
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
  const setDarkModeEnabled = useAppearanceStore(
    (state) => state.setDarkModeEnabled,
  );

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
          {completedCount === 2
            ? "You're all caught up for today."
            : `${2 - completedCount} item${2 - completedCount === 1 ? "" : "s"} left for today.`}
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
          description={catechismItem.question}
          href="/catechism"
          label="Catechism"
          meta={`Question ${catechismIndex + 1}`}
        />
      </View>

      <View style={{ alignItems: "center", paddingTop: 2 }}>
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
      </View>
    </ScrollView>
  );
}
