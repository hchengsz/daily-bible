type WebStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

type ProgressStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  removeItem: (key: string) => void | Promise<void>;
  setItem: (key: string, value: string) => void | Promise<void>;
};

const memoryStorage: Record<string, string> = {};

const getWebStorage = () =>
  (globalThis as unknown as { localStorage?: WebStorage }).localStorage;

export const progressStorage: ProgressStorage = {
  getItem: (key) => getWebStorage()?.getItem(key) ?? memoryStorage[key] ?? null,
  removeItem: (key) => {
    const storage = getWebStorage();

    if (storage) {
      storage.removeItem(key);
      return;
    }

    delete memoryStorage[key];
  },
  setItem: (key, value) => {
    const storage = getWebStorage();

    if (storage) {
      storage.setItem(key, value);
      return;
    }

    memoryStorage[key] = value;
  },
};
