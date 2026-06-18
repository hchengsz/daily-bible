import * as Speech from "expo-speech";
import { Pressable, ScrollView, Text, View } from "react-native";
import readingPlan from "../../src/raw/day148.json";
import { getVerse, getVerseRange } from "../../src/types/scripture";

type Reference = {
  book: string;
  chapter: number;
  verse: string;
};

type Paragraph = {
  title: string;
  references: Reference[];
};

type Section = {
  title: string;
  introduction?: string;
  paragraphs: Paragraph[];
};

type Day = {
  id: number;
  title: string;
  introduction: string;
  sections: Section[];
};

const FONT = 20;
const LINE_HEIGHT = 30;

export default function Home() {
  const today = readingPlan[0] as Day;

  const extractVerseNumber = (verse: string) =>
    Number(verse.replace(/[^\d]/g, ""));

  const renderReference = (ref: Reference) => {
    const { book, chapter, verse } = ref;

    if (verse.includes("-")) {
      const [startRaw, endRaw] = verse.split("-");
      const start = extractVerseNumber(startRaw);
      const end = extractVerseNumber(endRaw);

      const verses = getVerseRange(book, chapter, start, end);

      return verses
        .map((v, i) => `${start + i}. ${v ?? "[missing]"}`)
        .join("\n");
    }

    const verseNum = extractVerseNumber(verse);
    const text = getVerse(book, chapter, verseNum);

    return `${verseNum}. ${text ?? "[missing]"}`;
  };

  // 🔊 朗读（真正读经文内容）
  const handlePlay = () => {
    const textToSpeak = today.sections
      .flatMap((section) =>
        section.paragraphs.flatMap((p) =>
          p.references.flatMap((ref) => {
            const { book, chapter, verse } = ref;

            // range
            if (verse.includes("-")) {
              const [startRaw, endRaw] = verse.split("-");
              const start = extractVerseNumber(startRaw);
              const end = extractVerseNumber(endRaw);

              return getVerseRange(book, chapter, start, end);
            }

            // single verse
            const verseNum = extractVerseNumber(verse);
            const v = getVerse(book, chapter, verseNum);

            return v ? [v] : [];
          }),
        ),
      )
      .join(". ");

    if (!textToSpeak) return;

    Speech.stop(); // 防止重复叠读

    Speech.speak(textToSpeak, {
      language: "en-US",
      rate: 0.95,
      pitch: 1.0,
    });
  };

  // 📅 日期
  const now = new Date();
  const dateString = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* ===== Header ===== */}
      <View
        style={{
          height: 80,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingBottom: 10,
          borderBottomWidth: 0.5,
          borderColor: "#ddd",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{dateString}</Text>

        <Pressable onPress={handlePlay} style={{ padding: 6 }}>
          <Text style={{ fontSize: 20 }}>🔊</Text>
        </Pressable>
      </View>

      {/* ===== Content ===== */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 80,
        }}
      >
        {/* Title */}
        <Text style={{ fontSize: 24, fontWeight: "700" }}>{today.title}</Text>

        {/* Introduction */}
        <View
          style={{
            marginTop: 12,
            backgroundColor: "#f5f5f5",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 10,
            borderLeftWidth: 4,
            borderLeftColor: "#999",
          }}
        >
          <Text
            style={{
              fontSize: FONT,
              lineHeight: LINE_HEIGHT,
              color: "#333",
            }}
          >
            {today.introduction}
          </Text>
        </View>

        {/* Sections */}
        <View style={{ marginTop: 24, gap: 28 }}>
          {today.sections.map((section, sectionIndex) => (
            <View key={sectionIndex}>
              {/* Section title */}
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                {section.title}
              </Text>

              {/* Section intro */}
              {section.introduction && (
                <View
                  style={{
                    marginTop: 12,
                    backgroundColor: "#f5f5f5",
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 10,
                    borderLeftWidth: 4,
                    borderLeftColor: "#999",
                  }}
                >
                  <Text
                    style={{
                      fontSize: FONT,
                      lineHeight: LINE_HEIGHT,
                      color: "#333",
                    }}
                  >
                    {section.introduction}
                  </Text>
                </View>
              )}

              {/* Paragraphs */}
              {section.paragraphs.map((p, pIndex) => (
                <View key={pIndex} style={{ marginBottom: 18 }}>
                  <Text
                    style={{
                      fontSize: FONT,
                      fontWeight: "500",
                      marginBottom: 6,
                    }}
                  >
                    {p.title}
                  </Text>

                  {p.references.map((ref, rIndex) => (
                    <View key={rIndex} style={{ marginBottom: 10 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#666",
                          marginBottom: 4,
                        }}
                      >
                        {ref.book} {ref.chapter}:{ref.verse}
                      </Text>

                      <Text
                        style={{
                          fontSize: FONT,
                          lineHeight: LINE_HEIGHT,
                        }}
                      >
                        {renderReference(ref)}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
