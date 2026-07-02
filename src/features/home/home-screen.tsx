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

type TodoItemProps = {
  completed: boolean;
  description: string;
  href: "/reading" | "/catechism";
  label: string;
  meta: string;
};

function TodoItem({
  completed,
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
          backgroundColor: completed ? "#f4fbf6" : "#fff",
          borderColor: completed ? "#a8ddb7" : "#e2e2e2",
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
            <Text style={{ color: "#111", fontSize: 19, fontWeight: "700" }}>
              {label}
            </Text>
            <Text style={{ color: "#777", fontSize: 13, fontWeight: "600" }}>
              {completed ? "已完成" : "待完成"} · {meta}
            </Text>
          </View>

          <MaterialIcons
            name={completed ? "check-circle" : "radio-button-unchecked"}
            size={28}
            color={completed ? "#238a43" : "#9a9a9a"}
          />
        </View>

        <Text
          numberOfLines={2}
          style={{ color: "#3f3f3f", fontSize: 15, lineHeight: 22 }}
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

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{
        gap: 22,
        paddingBottom: 96,
        paddingHorizontal: 20,
        paddingTop: 72,
      }}
    >
      <View style={{ gap: 8 }}>
        <Text style={{ color: "#777", fontSize: 14, fontWeight: "600" }}>
          {formatDate(currentDate)}
        </Text>
        <Text style={{ color: "#111", fontSize: 30, fontWeight: "800" }}>
          今日任务
        </Text>
        <Text style={{ color: "#555", fontSize: 16, lineHeight: 23 }}>
          {completedCount === 2
            ? "今日的经文和要理问答都完成了。"
            : `还有 ${2 - completedCount} 项待完成。`}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <TodoItem
          completed={readingCompleted}
          description={readingReferenceSummary || "今日经文内容尚未配置。"}
          href="/reading"
          label={readingDay.title || "今日经文"}
          meta={`第 ${readingDay.id || ""} 天`}
        />

        <TodoItem
          completed={catechismCompleted}
          description={catechismItem.question}
          href="/catechism"
          label="要理问答"
          meta={`问答 ${catechismIndex + 1}`}
        />
      </View>
    </ScrollView>
  );
}
