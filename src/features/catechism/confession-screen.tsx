import { Button, Column, Host } from "@expo/ui";
import { useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearanceStore } from "../settings/appearance-store";
import { addDays, formatDate, getDateKey } from "../reading/reading-plan-utils";
import { useDailyProgressStore, useTaskCompletion } from "../progress/daily-progress-store";
import { getConfessionDayForDate } from "./confession-data";

export default function ConfessionScreen() {
  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState(today);
  const dark = useAppearanceStore(state => state.darkModeEnabled);
  const insets = useSafeAreaInsets();
  const day = getConfessionDayForDate(date);
  const complete = useDailyProgressStore(state => state.completeTask);
  const completed = useTaskCompletion(getDateKey(date), "confession");
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const color = dark ? "#f5f5f5" : "#111";
  useEffect(() => () => { void Speech.stop(); }, []);
  const changeDate = (offset: number) => {
    void Speech.stop();
    setSpeaking(false);
    setSpeechError("");
    setDate(value => addDays(value, offset));
  };
  return <ScrollView style={{ flex: 1, backgroundColor: dark ? "#0c0c0c" : "#fff" }} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 40, paddingHorizontal: 20, gap: 20, maxWidth: 760, width: "100%", alignSelf: "center" }}>
    <Text accessibilityRole="header" style={{ color, fontSize: 28, lineHeight: 36, fontWeight: "700" }}>西敏信条</Text>
    <Text style={{ color, fontSize: 16 }}>{formatDate(date)}</Text>
    <Host matchContents colorScheme={dark ? "dark" : "light"}><Column spacing={8}>
      <Button label="前一天" variant="outlined" disabled={getDateKey(date) <= Date.UTC(today.getFullYear(), 0, 1)} onPress={() => changeDate(-1)} />
      <Button label="后一天" variant="outlined" disabled={getDateKey(date) >= getDateKey(today)} onPress={() => changeDate(1)} />
    </Column></Host>
    <Text style={{ color: dark ? "#aaa" : "#666", lineHeight: 22 }}>Westminster Confession of Faith · 1647 英文文本。每天一节，172 节循环阅读。</Text>
    {day.entries.map(entry => <View key={entry.reference} style={{ gap: 12 }}>
      <Text selectable style={{ color, fontSize: 22, lineHeight: 30, fontWeight: "600" }}>{entry.title}</Text>
      <Text style={{ color: dark ? "#aaa" : "#666" }}>WCF {entry.reference}</Text>
      <Text selectable style={{ color, fontSize: 20, lineHeight: 32 }}>{entry.text}</Text>
    </View>)}
    <Host matchContents colorScheme={dark ? "dark" : "light"}><Column spacing={12}>
      <Button label={speaking ? "停止朗读" : "朗读英文"} variant="outlined" onPress={() => {
        if (speaking) { void Speech.stop(); setSpeaking(false); return; }
        setSpeechError(""); setSpeaking(true);
        Speech.speak(day.entries.map(entry => entry.text).join("\n"), { language: "en-US", onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => { setSpeaking(false); setSpeechError("朗读失败，请重试。"); } });
      }} />
      <Button label={completed ? "已完成今日信条阅读" : "完成今日信条阅读"} disabled={completed} onPress={() => complete(getDateKey(date), "confession")} />
      <Button label="查看正文来源" variant="text" onPress={() => { void Linking.openURL("https://archive.org/details/humbleadviceofas00west/mode/2up").catch(() => setSpeechError("无法打开来源链接，请检查网络。")); }} />
    </Column></Host>
    {!!speechError && <Text accessibilityRole="alert" style={{ color }}>{speechError}</Text>}
  </ScrollView>;
}
