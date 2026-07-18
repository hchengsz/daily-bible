import { Directory, File, Paths } from "expo-file-system";
import legacyStorage from "expo-sqlite/kv-store";

type ProgressStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

const STORAGE_DIRECTORY_NAME = "daily-bible-storage";
const storageDirectory = new Directory(Paths.document, STORAGE_DIRECTORY_NAME);

const sanitizeStorageKey = (key: string) =>
  key.trim().replace(/[^a-z0-9._-]/gi, "_");

const ensureStorageDirectory = () => {
  if (!storageDirectory.exists) {
    storageDirectory.create({ idempotent: true, intermediates: true });
  }
};

const getStorageFile = (key: string) =>
  new File(storageDirectory, `${sanitizeStorageKey(key)}.json`);

const readFileItem = (key: string) => {
  ensureStorageDirectory();

  const file = getStorageFile(key);

  return file.exists ? file.textSync() : null;
};

const writeFileItem = (key: string, value: string) => {
  ensureStorageDirectory();

  const file = getStorageFile(key);

  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }

  file.write(value);
};

const removeFileItem = (key: string) => {
  ensureStorageDirectory();

  const file = getStorageFile(key);

  if (file.exists) {
    file.delete();
  }
};

export const progressStorage: ProgressStorage = {
  getItem: async (key) => {
    const fileValue = readFileItem(key);

    if (fileValue !== null) {
      return fileValue;
    }

    const legacyValue = await legacyStorage.getItem(key);

    if (legacyValue !== null) {
      writeFileItem(key, legacyValue);
    }

    return legacyValue;
  },
  removeItem: async (key) => {
    removeFileItem(key);
    await legacyStorage.removeItem(key);
  },
  setItem: async (key, value) => {
    writeFileItem(key, value);
    await legacyStorage.setItem(key, value);
  },
};
