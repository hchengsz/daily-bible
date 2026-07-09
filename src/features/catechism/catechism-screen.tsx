import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentRef } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
const HEADER_EXPANDED_HEIGHT = 112;
const HEADER_COMPACT_HEIGHT = 80;
const HEADER_COLLAPSE_DISTANCE = 72;
const HEADER_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "long",
});

const formatHeaderDate = (date: Date) => HEADER_MONTH_FORMATTER.format(date);

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
  const isSelectedToday = selectedDateKey === currentDateKey;
  const currentYearStartKey = Date.UTC(currentDate.getFullYear(), 0, 1);
  const canGoPreviousDay = selectedDateKey > currentYearStartKey;
  const canGoNextDay = selectedDateKey < currentDateKey;
  const completeTask = useDailyProgressStore((state) => state.completeTask);
  const isCompleted = useTaskCompletion(selectedDateKey, "catechism");
  const darkModeEnabled = useAppearanceStore((state) => state.darkModeEnabled);
  const { celebrationProgress, isCelebrating, startCelebration } =
    useCompletionCelebration();
  const colors = {
    background: darkModeEnabled ? "#0c0c0c" : "#fff",
    border: darkModeEnabled ? "#303030" : "#ddd",
    chip: darkModeEnabled ? "#242424" : "#e7e7e7",
    label: darkModeEnabled ? "#a5a5a5" : "#666",
    text: darkModeEnabled ? "#f5f5f5" : "#111",
  };

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.value = 0;
  }, [scrollY, selectedDateKey]);

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

          <View
            style={{
              backgroundColor: colors.chip,
              borderRadius: 16,
              justifyContent: "center",
              minHeight: 31,
              paddingHorizontal: 12,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              CCC {reference}
            </Text>
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
            {dateString} | CCC {reference}
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          alignSelf: "center",
          maxWidth: 1000,
          paddingBottom: 80,
          paddingHorizontal: 20,
          paddingTop: 20,
          width: "100%",
        }}
        onScroll={handleCatechismScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: colors.background }}
      >
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
                    {paragraph}
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
    </View>
  );
}
