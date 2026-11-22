import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Lightweight localization foundation. Hindi-first (the product and audience
// default to Hindi); English is opt-in. Device auto-detection can be layered on
// later via expo-localization — this scaffold persists an explicit choice.
export type Locale = "hi" | "en";
const LOCALE_KEY = "pje_locale"; // a UI preference, not a secret → AsyncStorage
const DEFAULT_LOCALE: Locale = "hi";

type Dict = Record<string, string>;

// Common cross-screen strings. Screen-specific copy is added as screens are
// localized (PHASE 3/4); unknown keys fall back to English, then the key itself.
const en: Dict = {
  continue: "Continue",
  cancel: "Cancel",
  retry: "Retry",
  loading: "Loading…",
  somethingWentWrong: "Something went wrong",
  offline: "You're offline",
  backOnline: "Back online",
  language: "Language",
  english: "English",
  hindi: "हिन्दी",
  login: "Login",
  logout: "Log out",
  goOnline: "Go online",
  goOffline: "Go offline",
};

const hi: Dict = {
  continue: "आगे बढ़ें",
  cancel: "रद्द करें",
  retry: "फिर से",
  loading: "लोड हो रहा है…",
  somethingWentWrong: "कुछ गड़बड़ हो गई",
  offline: "आप ऑफ़लाइन हैं",
  backOnline: "फिर ऑनलाइन",
  language: "भाषा",
  english: "English",
  hindi: "हिन्दी",
  login: "लॉगिन",
  logout: "लॉग आउट",
  goOnline: "ऑनलाइन जाएँ",
  goOffline: "ऑफ़लाइन जाएँ",
};

const DICTS: Record<Locale, Dict> = { en, hi };

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLoc] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LOCALE_KEY);
        if (saved === "hi" || saved === "en") setLoc(saved);
      } catch {
        // keep default
      }
    })();
  }, []);

  const setLocale = (l: Locale) => {
    setLoc(l);
    AsyncStorage.setItem(LOCALE_KEY, l).catch(() => {});
  };

  const t = (key: string) => DICTS[locale][key] ?? en[key] ?? key;

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
