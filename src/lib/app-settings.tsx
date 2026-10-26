"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { t, type MessageKey } from "@/lib/i18n";

const STORAGE_KEY = "noongar.settings.v2";

export type BraceletFields = {
  showName: boolean;
  showRoom: boolean;
  showRemaining: boolean;
  showFlag: boolean;
};

export type AppSettings = {
  locale: "en";
  bracelet: BraceletFields;
};

const DEFAULT_SETTINGS: AppSettings = {
  locale: "en",
  bracelet: {
    showName: true,
    showRoom: true,
    showRemaining: true,
    showFlag: true,
  },
};

type AppSettingsValue = {
  settings: AppSettings;
  ready: boolean;
  setBraceletField: (key: keyof BraceletFields, value: boolean) => void;
  setBracelet: (fields: BraceletFields) => void;
  resetSettings: () => void;
  tr: (key: MessageKey) => string;
};

const AppSettingsContext = createContext<AppSettingsValue | null>(null);

function normalizeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const o = raw as Partial<AppSettings>;
  const b =
    o.bracelet && typeof o.bracelet === "object"
      ? (o.bracelet as Partial<BraceletFields>)
      : {};
  return {
    locale: "en",
    bracelet: {
      showName: b.showName !== false,
      showRoom: b.showRoom !== false,
      showRemaining: b.showRemaining !== false,
      showFlag: b.showFlag !== false,
    },
  };
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setSettings(normalizeSettings(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: AppSettings) => {
    setSettings(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setBraceletField = useCallback(
    (key: keyof BraceletFields, value: boolean) => {
      persist({
        ...settings,
        bracelet: { ...settings.bracelet, [key]: value },
      });
    },
    [persist, settings],
  );

  const setBracelet = useCallback(
    (fields: BraceletFields) => {
      persist({ ...settings, bracelet: fields });
    },
    [persist, settings],
  );

  const resetSettings = useCallback(() => {
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  useEffect(() => {
    if (ready && typeof document !== "undefined") {
      document.documentElement.lang = "en";
    }
  }, [ready]);

  const tr = useCallback((key: MessageKey) => t("en", key), []);

  const value = useMemo(
    () => ({
      settings,
      ready,
      setBraceletField,
      setBracelet,
      resetSettings,
      tr,
    }),
    [settings, ready, setBraceletField, setBracelet, resetSettings, tr],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}
