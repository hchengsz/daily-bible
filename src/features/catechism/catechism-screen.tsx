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
import { useAppearanceStore } from "../settings/appearance-store";

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
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
  const { celebrationProgress, isCelebrating, startCelebration } =
    useCompletionCelebration();
  const colors = {
    background: darkModeEnabled ? "#0c0c0c" : "#fff",
    border: darkModeEnabled ? "#303030" : "#e5e5e5",
    card: darkModeEnabled ? "#171717" : "#f6f6f6",
    label: darkModeEnabled ? "#a5a5a5" : "#777",
    muted: darkModeEnabled ? "#c9c9c9" : "#666",
    separator: darkModeEnabled ? "#303030" : "#e8e8e8",
    text: darkModeEnabled ? "#f5f5f5" : "#111",
  };

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          alignSelf: "center",
          gap: 24,
          maxWidth: 1000,
          paddingBottom: 96,
          paddingHorizontal: 20,
          paddingTop: 72,
          width: "100%",
        }}
      >
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.label, fontSize: 14, fontWeight: "600" }}>
            Daily Formation
          </Text>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
            Catechism
          </Text>
          <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>
            Compendium of the Catechism of the Catholic Church
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
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
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>
              Question {selectedIndex + 1}
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityLabel="Previous catechism question"
                accessibilityRole="button"
                onPress={goToPrevious}
                style={{
                  alignItems: "center",
                  borderColor: colors.border,
                  borderRadius: 18,
                  borderWidth: 1,
                  height: 36,
                  justifyContent: "center",
                  width: 36,
                }}
              >
                <MaterialIcons name="chevron-left" size={24} color={colors.text} />
              </Pressable>

              <Pressable
                accessibilityLabel="Next catechism question"
                accessibilityRole="button"
                onPress={goToNext}
                style={{
                  alignItems: "center",
                  borderColor: colors.border,
                  borderRadius: 18,
                  borderWidth: 1,
                  height: 36,
                  justifyContent: "center",
                  width: 36,
                }}
              >
                <MaterialIcons name="chevron-right" size={24} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.label, fontSize: 13, fontWeight: "700" }}>
              Question
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 23,
                fontWeight: "700",
                lineHeight: 31,
              }}
            >
              {selectedItem.question}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.label, fontSize: 13, fontWeight: "700" }}>
              Answer
            </Text>
            <Text style={{ color: colors.text, fontSize: 20, lineHeight: 30 }}>
              {selectedItem.answer}
            </Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
            Catechism References
          </Text>
          {selectedItem.references.map((reference) => (
            <View
              key={reference}
              style={{
                borderBottomColor: colors.separator,
                borderBottomWidth: 1,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 17 }}>{reference}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 12 }}>
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
              {isCompleted ? "Today's catechism is complete" : "Complete Today's Catechism"}
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
              Come back tomorrow and keep going.
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
