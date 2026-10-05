import { Button, Column, Host, TextInput, useNativeState } from "@expo/ui";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
import { loadApiKeys, saveApiKeys, useApiKeyStore } from "./api-key-store";

// Expo UI universal ObservableState uses mutable .value (the web API has no .set()).
/* eslint-disable react-hooks/immutability */
function ApiKeyForm({ dark, onClose }: { dark: boolean; onClose: (saved: boolean) => void }) {
  const gemini = useNativeState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [inputWidth, setInputWidth] = useState<number>();
  const color = dark ? "#f5f5f5" : "#111";
  const muted = dark ? "#a5a5a5" : "#666";

  useEffect(() => {
    let mounted = true;
    loadApiKeys().then(() => {
      if (!mounted) return;
      const keys = useApiKeyStore.getState();
      gemini.value = keys.gemini;
      setReady(true);
    }).catch(() => {
      if (mounted) setError("Could not load your saved key. Close this form and try again.");
    });
    return () => { mounted = false; };
  }, [gemini]);

  const save = async () => {
    if (!ready || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await saveApiKeys({ gemini: gemini.value });
      onClose(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.message.startsWith("API Key")
        ? cause.message : "Could not save your key. Your input has been kept. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!savingRef.current) onClose(false); }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 520, maxHeight: "90%", alignSelf: "center", borderRadius: 20, backgroundColor: dark ? "#171717" : "#fff" }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 16 }}>
            <Text accessibilityRole="header" style={{ color, fontSize: 24, fontWeight: "700" }}>API Settings</Text>
            <Text style={{ color: muted, lineHeight: 22 }}>Use your Gemini key for AI translation and vocabulary analysis.</Text>
            <Text style={{ color, fontWeight: "600" }}>Gemini API Key</Text>
            {/* Match only height so long keys cannot expand the native host horizontally. */}
            <Host matchContents={{ vertical: true }} style={{ width: "100%", overflow: "hidden" }}
              onLayout={(event) => setInputWidth(event.nativeEvent.layout.width)} colorScheme={dark ? "dark" : "light"}>
              <TextInput value={gemini} onChangeText={(text) => { "worklet"; gemini.value = text; }}
                placeholder="Paste your Gemini API key" secureTextEntry={!visible} editable={ready && !saving}
                multiline={visible} numberOfLines={visible ? 5 : 1}
                autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={256}
                textStyle={{ color, fontSize: 16, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
                style={{ width: inputWidth, backgroundColor: dark ? "#171717" : "#fff", borderWidth: 1, borderColor: dark ? "#555" : "#ccc", borderRadius: 8, padding: 12, height: visible ? 144 : 48 }} />
            </Host>
            <Text style={{ color: muted, lineHeight: 20, fontSize: 13 }}>
              {visible ? "Scroll within the field to review and edit your full key. Line wrapping does not change it." : "Select Show key to review and edit the full key."}
            </Text>
            <Text style={{ color: muted, lineHeight: 20, fontSize: 13 }}>
              {Platform.OS === "web" ? "On the web, your key lasts only for this page session. " : "Your key is stored securely on this device. "}
              {"When you use AI, your key passes through our server to Gemini. Saving does not make an AI request. Clear and save to remove your key."}
            </Text>
            {!!error && <Text accessibilityRole="alert" style={{ color: dark ? "#ff9292" : "#b42318" }}>{error}</Text>}
            <Host matchContents colorScheme={dark ? "dark" : "light"}>
              <Column spacing={10}>
                <Button label={visible ? "Hide key" : "Show key"} variant="text" disabled={saving} onPress={() => setVisible(!visible)} />
                <Button label="Clear input" variant="text" disabled={!ready || saving} onPress={() => { gemini.value = ""; }} />
                <Button label={saving ? "Saving…" : "Save key"} disabled={!ready || saving} onPress={() => { void save(); }} />
                <Button label="Cancel" variant="outlined" disabled={saving} onPress={() => onClose(false)} />
              </Column>
            </Host>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ApiKeySettings({ dark }: { dark: boolean }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasGemini = useApiKeyStore(state => Boolean(state.gemini));
  useEffect(() => { void loadApiKeys().catch(() => {}); }, []);
  return (
    <View style={{ gap: 8 }}>
      <Host matchContents colorScheme={dark ? "dark" : "light"}>
        <Button label="Manage Gemini API Key" variant="outlined" onPress={() => { setSaved(false); setOpen(true); }} />
      </Host>
      <Text accessibilityLiveRegion="polite" style={{ color: dark ? "#a5a5a5" : "#666", textAlign: "center", fontSize: 13 }}>
        {saved ? "Saved · " : ""}{`Gemini ${hasGemini ? "configured" : "not configured"}`}
      </Text>
      {open && <ApiKeyForm dark={dark} onClose={(didSave) => { setOpen(false); setSaved(didSave); }} />}
    </View>
  );
}
