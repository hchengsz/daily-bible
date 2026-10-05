import { Button, Column, Host, Text as NativeText } from "@expo/ui";
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
    catch { setError("Could not save. Your selection has been kept. Please try again."); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <View style={{ gap: 22 }}>
    <Text accessibilityRole="header" style={{ color, fontSize: firstLaunch ? 28 : 22, fontWeight: "700" }}>
      {firstLaunch ? "Find your daily rhythm." : "Your tradition"}
    </Text>
    <Text style={{ color: dark ? "#aab8af" : "#63736a", fontSize: 16, lineHeight: 25 }}>Choose a reading tradition for Daily Bible. You can change this anytime in Settings.</Text>
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }} colorScheme={dark ? "dark" : "light"}>
      <Column spacing={16}>
        {([
          { id: "catholic", title: "Catholic", description: "Bible & Catholic Catechism" },
          { id: "protestant", title: "Protestant", description: "Bible & Westminster Confession" },
        ] as const).map(option => <Button key={option.id} variant="outlined" disabled={saving} onPress={() => setDraft(option.id)} style={{ width: "100%", paddingVertical: 28, paddingHorizontal: 20, borderRadius: 24, borderWidth: draft === option.id ? 2 : 1, borderColor: draft === option.id ? "#3c7659" : dark ? "#354139" : "#dce5df", backgroundColor: draft === option.id ? dark ? "#203b2e" : "#edf5ef" : dark ? "#151e19" : "#fafcfb" }}>
          <Column spacing={8}>
            <NativeText textStyle={{ fontSize: 28, fontWeight: "700", color }}>{`${draft === option.id ? "✓  " : ""}${option.title}`}</NativeText>
            <NativeText textStyle={{ fontSize: 14, color: dark ? "#adbbb2" : "#63736a" }}>{option.description}</NativeText>
          </Column>
        </Button>)}
        <Button label={saving ? "Saving…" : firstLaunch ? "Start reading" : "Save selection"} disabled={!draft || saving || (!firstLaunch && draft === current)} onPress={() => { void save(); }} />
      </Column>
    </Host>
    {!firstLaunch && <Text accessibilityLiveRegion="polite" style={{ color }}>Current: {current === "protestant" ? "Protestant" : "Catholic"}</Text>}
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
        <Host matchContents><Button label="Retry" onPress={() => { void loadTradition(); }} /></Host>
      </> : <ActivityIndicator color={dark ? "#fff" : "#111"} accessibilityLabel="Loading settings" />}
    </View>
  </ScrollView>;
}
