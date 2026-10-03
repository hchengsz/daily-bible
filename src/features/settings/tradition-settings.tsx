import { Button, Column, Host } from "@expo/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadTradition, saveTradition, useTraditionStore, type Tradition } from "./tradition-store";
import { useAppearanceStore } from "./appearance-store";

export function TraditionSettings({ dark, firstLaunch = false }: { dark: boolean; firstLaunch?: boolean }) {
  const current = useTraditionStore(state => state.tradition);
  const [draft, setDraft] = useState<Tradition | null>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const color = dark ? "#f5f5f5" : "#111";
  const save = async () => {
    if (!draft || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try { await saveTradition(draft); }
    catch { setError("保存失败，请重试。您的选择已保留。"); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <View style={{ gap: 14 }}>
    <Text accessibilityRole="header" style={{ color, fontSize: firstLaunch ? 28 : 22, fontWeight: "700" }}>
      {firstLaunch ? "欢迎使用 Daily Bible" : "信仰与阅读设置"}
    </Text>
    <Text style={{ color, fontSize: 16, lineHeight: 25 }}>请选择您的信仰传统。天主教使用《天主教教理》，基督新教使用《西敏信条》英文全文。圣经阅读暂时相同，之后可在首页设置中修改。</Text>
    <Host matchContents colorScheme={dark ? "dark" : "light"}>
      <Column spacing={12}>
        <Button label={`${draft === "catholic" ? "✓ " : ""}天主教徒`} variant={draft === "catholic" ? "filled" : "outlined"} disabled={saving} onPress={() => setDraft("catholic")} />
        <Button label={`${draft === "protestant" ? "✓ " : ""}基督新教徒`} variant={draft === "protestant" ? "filled" : "outlined"} disabled={saving} onPress={() => setDraft("protestant")} />
        <Button label={saving ? "正在保存…" : firstLaunch ? "开始阅读" : "保存选择"} disabled={!draft || saving || (!firstLaunch && draft === current)} onPress={() => { void save(); }} />
      </Column>
    </Host>
    {!firstLaunch && <Text accessibilityLiveRegion="polite" style={{ color }}>当前：{current === "protestant" ? "基督新教 · 西敏信条" : "天主教 · 天主教教理"}</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: dark ? "#ff9292" : "#b42318" }}>{error}</Text>}
  </View>;
}

export function TraditionGate({ children }: { children: ReactNode }) {
  const { tradition, hydrated, error } = useTraditionStore();
  const dark = useAppearanceStore(state => state.darkModeEnabled);
  const insets = useSafeAreaInsets();
  useEffect(() => { void loadTradition(); }, []);
  if (hydrated && tradition) return children;
  return <ScrollView style={{ flex: 1, backgroundColor: dark ? "#0c0c0c" : "#fff" }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
    <View style={{ width: "100%", maxWidth: 540, alignSelf: "center" }}>
      {hydrated ? <TraditionSettings dark={dark} firstLaunch /> : error ? <>
        <Text accessibilityRole="alert" style={{ color: dark ? "#fff" : "#111", marginBottom: 16 }}>{error}</Text>
        <Host matchContents><Button label="重试" onPress={() => { void loadTradition(); }} /></Host>
      </> : <ActivityIndicator color={dark ? "#fff" : "#111"} accessibilityLabel="正在读取设置" />}
    </View>
  </ScrollView>;
}
