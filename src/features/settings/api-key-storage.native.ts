import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "daily-bible.api-keys";
export const readApiKeys = () => SecureStore.getItemAsync(STORAGE_KEY);
export const writeApiKeys = (value: string | null) => value === null
  ? SecureStore.deleteItemAsync(STORAGE_KEY)
  : SecureStore.setItemAsync(STORAGE_KEY, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
