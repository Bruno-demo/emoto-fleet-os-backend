'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Locale } from '@/lib/i18n/dictionaries';

interface LanguageContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('fleet_os_locale');
    if (saved === 'en' || saved === 'rw') {
      setTimeout(() => {
        setLocaleState(saved as Locale);
      }, 0);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('fleet_os_locale', newLocale);
  };

  const t = (key: string, fallback?: string): string => {
    const dict = translations[locale] as Record<string, string>;
    const value = dict[key];
    if (value) return value;

    // Fallback to English
    const enDict = translations.en as Record<string, string>;
    const enValue = enDict[key];
    if (enValue) return enValue;

    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
