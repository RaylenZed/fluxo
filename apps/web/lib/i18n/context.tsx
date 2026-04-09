'use client';

import { createContext, useContext, useState } from 'react';
import translations, { type Locale, type TranslationKeys } from './translations';

const STORAGE_KEY = 'fluxo-locale';
const DEFAULT_LOCALE: Locale = 'en';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TranslationKeys;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: translations[DEFAULT_LOCALE],
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer: read from localStorage on first render (client-only).
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored === 'en' || stored === 'zh' ? stored : DEFAULT_LOCALE;
  });

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: translations[locale] as TranslationKeys }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
