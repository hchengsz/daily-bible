import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { TraditionSettings } from "./tradition-settings";
import { ApiKeySettings } from "./api-key-settings";

export function SettingsMenu({ dark }: { dark: boolean }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const color = dark ? "#f5f5f5" : "#172e25";
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => setOpen(true)} style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: dark ? "#202924" : "#f0f4f1" }}>
      <MaterialIcons name="settings" size={26} color={color} />
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={{ flex: 1, backgroundColor: dark ? "#0c0c0c" : "#fff", paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text accessibilityRole="header" style={{ color, fontSize: 30, fontWeight: "700" }}>Settings</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={() => setOpen(false)} style={{ padding: 12 }}><MaterialIcons name="close" size={26} color={color} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32, gap: 32, width: "100%", maxWidth: 600, alignSelf: "center" }}>
          <TraditionSettings dark={dark} />
          <View style={{ height: 1, backgroundColor: dark ? "#303830" : "#e4e9e5" }} />
          <Text style={{ color, fontSize: 24, fontWeight: "600" }}>AI & Translation</Text>
          <ApiKeySettings dark={dark} />
        </ScrollView>
      </View>
    </Modal>
  </>;
}
