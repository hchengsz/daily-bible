import { ScrollView, Text, View } from "react-native";
import readingPlan from "../../src/raw/day146.json";
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

  // 今日日期
  const todayDate = new Date();
  const dateString = `${todayDate.getFullYear()}-${String(
    todayDate.getMonth() + 1,
  ).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

  const handlePlay = () => {
    // 以后接 TTS（先留接口）
    console.log("play reading...");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* ===== Header（80px） ===== */}
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
        {/* 左侧：日期 */}
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{dateString}</Text>

        {/* 右侧：朗读按钮 */}
        <Pressable onPress={handlePlay}>
          <Text style={{ fontSize: 18 }}>🔊</Text>
        </Pressable>
      </View>

      {/* ===== 内容区域 ===== */}
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
        <Text
          style={{
            fontSize: FONT,
            lineHeight: LINE_HEIGHT,
            marginTop: 12,
          }}
        >
          {today.introduction}
        </Text>

        {/* Sections */}
        <View style={{ marginTop: 24, gap: 28 }}>
          {today.sections.map((section, sectionIndex) => (
            <View key={sectionIndex}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                {section.title}
              </Text>

              {section.introduction && (
                <Text
                  style={{
                    fontSize: FONT,
                    lineHeight: LINE_HEIGHT,
                    marginBottom: 16,
                  }}
                >
                  {section.introduction}
                </Text>
              )}

              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <View key={paragraphIndex} style={{ marginBottom: 18 }}>
                  <Text
                    style={{
                      fontSize: FONT,
                      fontWeight: "500",
                      marginBottom: 6,
                    }}
                  >
                    {paragraph.title}
                  </Text>

                  {paragraph.references.map((ref, refIndex) => (
                    <View key={refIndex} style={{ marginBottom: 10 }}>
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
