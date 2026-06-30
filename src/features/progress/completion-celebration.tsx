import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { Animated, Easing, useWindowDimensions, View } from "react-native";

// Seven colors for the seven days of creation.
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

export const useCompletionCelebration = () => {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationProgress = useRef(new Animated.Value(0)).current;

  const startCelebration = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    setIsCelebrating(true);
    celebrationProgress.setValue(0);
    Animated.timing(celebrationProgress, {
      duration: 1900,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start(() => setIsCelebrating(false));
  }, [celebrationProgress]);

  return {
    celebrationProgress,
    isCelebrating,
    startCelebration,
  };
};

export function CompletionCelebrationOverlay({
  isVisible,
  progress,
}: {
  isVisible: boolean;
  progress: Animated.Value;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  if (!isVisible) {
    return null;
  }

  return (
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
        const translateX = progress.interpolate({
          extrapolate: "clamp",
          inputRange: [0, 0.12, 0.52],
          outputRange: [0, 0, Math.cos(spark.angle) * spark.distance],
        });
        const translateY = progress.interpolate({
          extrapolate: "clamp",
          inputRange: [0, 0.12, 0.52],
          outputRange: [0, 0, Math.sin(spark.angle) * spark.distance],
        });
        const opacity = progress.interpolate({
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
        const translateX = progress.interpolate({
          extrapolate: "clamp",
          inputRange: [0, start, 1],
          outputRange: [0, 0, piece.drift],
        });
        const translateY = progress.interpolate({
          extrapolate: "clamp",
          inputRange: [0, start, 1],
          outputRange: [-24, -24, piece.travel],
        });
        const rotate = progress.interpolate({
          extrapolate: "clamp",
          inputRange: [0, start, 1],
          outputRange: ["0deg", "0deg", `${piece.rotate}deg`],
        });
        const opacity = progress.interpolate({
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
  );
}
