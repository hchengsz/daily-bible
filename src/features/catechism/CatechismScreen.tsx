import { MaterialIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const catechismItems = [
  {
    answer:
      "Man's chief end is to glorify God, and to enjoy him forever.",
    question: "What is the chief end of man?",
    references: ["1 Corinthians 10:31", "Psalm 73:25-26"],
  },
  {
    answer:
      "The Word of God, which is contained in the Scriptures of the Old and New Testaments, is the only rule to direct us how we may glorify and enjoy him.",
    question: "What rule has God given to direct us how we may glorify and enjoy him?",
    references: ["2 Timothy 3:16", "Ephesians 2:20"],
  },
  {
    answer:
      "The Scriptures principally teach what man is to believe concerning God, and what duty God requires of man.",
    question: "What do the Scriptures principally teach?",
    references: ["John 20:31", "Micah 6:8"],
  },
  {
    answer:
      "God is a Spirit, infinite, eternal, and unchangeable, in his being, wisdom, power, holiness, justice, goodness, and truth.",
    question: "What is God?",
    references: ["John 4:24", "Psalm 90:2"],
  },
  {
    answer:
      "There is but one only, the living and true God.",
    question: "Are there more Gods than one?",
    references: ["Deuteronomy 6:4", "Jeremiah 10:10"],
  },
  {
    answer:
      "There are three persons in the Godhead: the Father, the Son, and the Holy Ghost; and these three are one God, the same in substance, equal in power and glory.",
    question: "How many persons are there in the Godhead?",
    references: ["Matthew 28:19", "2 Corinthians 13:14"],
  },
];

const getDayOfYear = (date: Date) => {
  const startOfYear = Date.UTC(date.getFullYear(), 0, 1);
  const startOfDay = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  return Math.floor((startOfDay - startOfYear) / DAY_IN_MS) + 1;
};

export default function CatechismScreen() {
  const initialIndex = useMemo(
    () => (getDayOfYear(new Date()) - 1) % catechismItems.length,
    [],
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const selectedItem = catechismItems[selectedIndex];

  const goToPrevious = () => {
    setSelectedIndex((index) =>
      index === 0 ? catechismItems.length - 1 : index - 1,
    );
  };

  const goToNext = () => {
    setSelectedIndex((index) => (index + 1) % catechismItems.length);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{
        gap: 24,
        paddingBottom: 72,
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
          <Text style={{ color: "#111", fontSize: 23, fontWeight: "700", lineHeight: 31 }}>
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
    </ScrollView>
  );
}
