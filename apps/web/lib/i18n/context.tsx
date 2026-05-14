'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';
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

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  return stored === 'en' || stored === 'zh' ? stored : DEFAULT_LOCALE;
}

function subscribeLocale(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('storage', onStoreChange);
  window.addEventListener('fluxo-locale-change', onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener('fluxo-locale-change', onStoreChange);
  };
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => DEFAULT_LOCALE);

  const setLocale = (l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l);
    window.dispatchEvent(new Event('fluxo-locale-change'));
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
