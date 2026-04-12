'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === 'en' || stored === 'zh') {
      setLocaleState(stored);
    }
  }, []);

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
