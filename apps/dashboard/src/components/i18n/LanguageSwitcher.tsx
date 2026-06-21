'use client';

import { Globe } from 'lucide-react';
import { useTranslation } from './LanguageProvider';
import { useState, useRef, useEffect } from 'react';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-muted/30 px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-surface-hover hover:text-ink transition-all cursor-pointer backdrop-blur-sm"
      >
        <Globe size={14} className="text-accent" />
        <span className="hidden md:inline">{locale === 'en' ? 'English' : 'Kinyarwanda'}</span>
        <span className="inline md:hidden uppercase">{locale}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-xl border border-line bg-surface shadow-[var(--shadow-strong)] backdrop-blur-md overflow-hidden z-50">
          <div className="py-1">
            <button
              onClick={() => {
                setLocale('en');
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-surface-hover transition-colors ${
                locale === 'en' ? 'text-accent bg-accent/5' : 'text-ink-soft'
              }`}
            >
              English
            </button>
            <button
              onClick={() => {
                setLocale('rw');
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-surface-hover transition-colors ${
                locale === 'rw' ? 'text-accent bg-accent/5' : 'text-ink-soft'
              }`}
            >
              Kinyarwanda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
