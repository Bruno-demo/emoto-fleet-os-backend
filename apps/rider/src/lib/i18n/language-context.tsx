import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SupportedLanguage, Translations, translations } from './translations';

const LANGUAGE_STORAGE_KEY = 'emoto_rider_language';

function canUseSecureStore(): boolean {
  return (
    Platform.OS !== 'web' &&
    typeof SecureStore.getItemAsync === 'function' &&
    typeof SecureStore.setItemAsync === 'function'
  );
}

async function readStoredLanguage(): Promise<SupportedLanguage> {
  try {
    let stored: string | null = null;
    if (canUseSecureStore()) {
      stored = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
    } else if (typeof globalThis.localStorage !== 'undefined') {
      stored = globalThis.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    }
    if (stored === 'rw' || stored === 'en') {
      return stored;
    }
  } catch (e) {
    // Ignore storage errors and fall back to default
  }
  return 'en';
}

async function writeStoredLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    if (canUseSecureStore()) {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lang);
    } else if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  } catch (e) {
    // Ignore storage write errors
  }
}

interface LanguageContextValue {
  locale: SupportedLanguage;
  setLocale: (lang: SupportedLanguage) => Promise<void>;
  t: Translations;
  isEn: boolean;
  isRw: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLanguage>('en');

  useEffect(() => {
    void (async () => {
      const savedLang = await readStoredLanguage();
      setLocaleState(savedLang);
    })();
  }, []);

  const setLocale = async (newLang: SupportedLanguage) => {
    setLocaleState(newLang);
    await writeStoredLanguage(newLang);
  };

  const value: LanguageContextValue = {
    locale,
    setLocale,
    t: translations[locale] || translations.en,
    isEn: locale === 'en',
    isRw: locale === 'rw',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
