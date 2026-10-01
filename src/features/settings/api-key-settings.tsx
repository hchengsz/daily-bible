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
      if (mounted) setError("无法读取已保存的密钥，请关闭后重试。");
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
        ? cause.message : "密钥保存失败，请重试。输入内容已保留。");
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
            <Text accessibilityRole="header" style={{ color, fontSize: 24, fontWeight: "700" }}>API 设置</Text>
            <Text style={{ color: muted, lineHeight: 22 }}>Gemini 用于 AI 翻译和词汇分析。</Text>
            <Text style={{ color, fontWeight: "600" }}>AI API Key（Gemini）</Text>
            {/* Match only height so long keys cannot expand the native host horizontally. */}
            <Host matchContents={{ vertical: true }} style={{ width: "100%", overflow: "hidden" }}
              onLayout={(event) => setInputWidth(event.nativeEvent.layout.width)} colorScheme={dark ? "dark" : "light"}>
              <TextInput value={gemini} onChangeText={(text) => { "worklet"; gemini.value = text; }}
                placeholder="粘贴 Gemini API Key" secureTextEntry={!visible} editable={ready && !saving}
                multiline={visible} numberOfLines={visible ? 5 : 1}
                autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={256}
                textStyle={{ color, fontSize: 16, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
                style={{ width: inputWidth, backgroundColor: dark ? "#171717" : "#fff", borderWidth: 1, borderColor: dark ? "#555" : "#ccc", borderRadius: 8, padding: 12, height: visible ? 144 : 48 }} />
            </Host>
            <Text style={{ color: muted, lineHeight: 20, fontSize: 13 }}>
              {visible ? "密钥已显示，可在输入框内滚动查看并修改中间字符。自动换行不会改变密钥内容。" : "点击“显示密钥”可展开多行输入框，核对和修改完整密钥。"}
            </Text>
            <Text style={{ color: muted, lineHeight: 20, fontSize: 13 }}>
              {Platform.OS === "web" ? "网页端仅在当前页面会话中保存，刷新后需要重新填写。" : "密钥加密保存在此设备上。"}
              {"使用功能时，密钥会经应用服务器发送到对应服务。保存不会发起付费请求，首次使用时验证密钥。清空并保存可移除个人密钥。"}
            </Text>
            {!!error && <Text accessibilityRole="alert" style={{ color: dark ? "#ff9292" : "#b42318" }}>{error}</Text>}
            <Host matchContents colorScheme={dark ? "dark" : "light"}>
              <Column spacing={10}>
                <Button label={visible ? "隐藏密钥" : "显示密钥"} variant="text" disabled={saving} onPress={() => setVisible(!visible)} />
                <Button label="清空输入" variant="text" disabled={!ready || saving} onPress={() => { gemini.value = ""; }} />
                <Button label={saving ? "正在保存…" : "保存设置"} disabled={!ready || saving} onPress={() => { void save(); }} />
                <Button label="取消" variant="outlined" disabled={saving} onPress={() => onClose(false)} />
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
        <Button label="API 设置 · 翻译与 AI" variant="outlined" onPress={() => { setSaved(false); setOpen(true); }} />
      </Host>
      <Text accessibilityLiveRegion="polite" style={{ color: dark ? "#a5a5a5" : "#666", textAlign: "center", fontSize: 13 }}>
        {saved ? "设置已保存 · " : ""}{`Gemini ${hasGemini ? "已配置" : "未配置"}`}
      </Text>
      {open && <ApiKeyForm dark={dark} onClose={(didSave) => { setOpen(false); setSaved(didSave); }} />}
    </View>
  );
}
