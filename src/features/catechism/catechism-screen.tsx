import { MaterialIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { catechismItems, getCatechismIndexForDate } from "./catechism-data";
import {
  CompletionCelebrationOverlay,
  useCompletionCelebration,
} from "../progress/completion-celebration";
import {
  useDailyProgressStore,
  useTaskCompletion,
} from "../progress/daily-progress-store";
import { getDateKey } from "../reading/reading-plan-utils";

export default function CatechismScreen() {
  const currentDate = useMemo(() => new Date(), []);
  const dateKey = getDateKey(currentDate);
  const initialIndex = useMemo(
    () => getCatechismIndexForDate(currentDate),
    [currentDate],
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const selectedItem = catechismItems[selectedIndex];
  const completeTask = useDailyProgressStore((state) => state.completeTask);
  const isCompleted = useTaskCompletion(dateKey, "catechism");
  const { celebrationProgress, isCelebrating, startCelebration } =
    useCompletionCelebration();

  const goToPrevious = () => {
    setSelectedIndex((index) =>
      index === 0 ? catechismItems.length - 1 : index - 1,
    );
  };

  const goToNext = () => {
    setSelectedIndex((index) => (index + 1) % catechismItems.length);
  };

  const handleCompleteCatechism = () => {
    completeTask(dateKey, "catechism");
    startCelebration();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{
          gap: 24,
          paddingBottom: 96,
          paddingHorizontal: 20,
          paddingTop: 72,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text style={{ color: "#777", fontSize: 14, fontWeight: "600" }}>
            Catechism
          </Text>
          <Text style={{ color: "#111", fontSize: 30, fontWeight: "800" }}>
            要理问答阅读
          </Text>
          <Text style={{ color: "#666", fontSize: 15, lineHeight: 22 }}>
            Westminster Shorter Catechism
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#f6f6f6",
            borderColor: "#e5e5e5",
            borderRadius: 20,
            borderCurve: "continuous",
            borderWidth: 1,
            gap: 18,
            padding: 18,
          }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "#555", fontSize: 14, fontWeight: "700" }}>
              问答 {selectedIndex + 1}
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityLabel="上一条要理问答"
                accessibilityRole="button"
                onPress={goToPrevious}
                style={{
                  alignItems: "center",
                  borderColor: "#d0d0d0",
                  borderRadius: 18,
                  borderWidth: 1,
                  height: 36,
                  justifyContent: "center",
                  width: 36,
                }}
              >
                <MaterialIcons name="chevron-left" size={24} color="#222" />
              </Pressable>

              <Pressable
                accessibilityLabel="下一条要理问答"
                accessibilityRole="button"
                onPress={goToNext}
                style={{
                  alignItems: "center",
                  borderColor: "#d0d0d0",
                  borderRadius: 18,
                  borderWidth: 1,
                  height: 36,
                  justifyContent: "center",
                  width: 36,
                }}
              >
                <MaterialIcons name="chevron-right" size={24} color="#222" />
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: "#777", fontSize: 13, fontWeight: "700" }}>
              Question
            </Text>
            <Text
              style={{
                color: "#111",
                fontSize: 23,
                fontWeight: "700",
                lineHeight: 31,
              }}
            >
              {selectedItem.question}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: "#777", fontSize: 13, fontWeight: "700" }}>
              Answer
            </Text>
            <Text style={{ color: "#222", fontSize: 20, lineHeight: 30 }}>
              {selectedItem.answer}
            </Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: "#111", fontSize: 18, fontWeight: "700" }}>
            Scripture References
          </Text>
          {selectedItem.references.map((reference) => (
            <View
              key={reference}
              style={{
                borderBottomColor: "#e8e8e8",
                borderBottomWidth: 1,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: "#333", fontSize: 17 }}>{reference}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={handleCompleteCatechism}
            style={{
              alignItems: "center",
              backgroundColor: isCompleted ? "#f1f8f4" : "#111",
              borderColor: isCompleted ? "#9bd8ad" : "#111",
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
                color: isCompleted ? "#1f7a3a" : "#fff",
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              {isCompleted ? "今日要理问答已完成" : "完成今日要理问答"}
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
              明天继续回来，慢慢扎根。
            </Text>
          )}
        </View>
      </ScrollView>

      <CompletionCelebrationOverlay
        isVisible={isCelebrating}
        progress={celebrationProgress}
      />
    </View>
  );
}
