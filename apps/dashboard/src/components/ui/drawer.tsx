'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { cx } from '@/lib/ui';

interface DrawerProps {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg';
}

// Provides a reusable detail drawer for bike and incident workflows.
export function Drawer({
  open,
  title,
  description,
  children,
  onClose,
  size = 'lg',
}: DrawerProps) {
  // Allows keyboard users to close the drawer quickly with Escape.
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      className={cx(
        'fixed inset-0 z-[1100] transition',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        className={cx(
          'absolute inset-0 bg-slate-950/30 backdrop-blur-[2px] transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cx(
          'dashboard-scrollbar absolute right-0 top-0 h-full overflow-y-auto border-l border-line bg-surface shadow-[var(--shadow-strong)] transition-transform',
          size === 'lg' ? 'w-full max-w-[34rem]' : 'w-full max-w-[28rem]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="sticky top-0 z-10 border-b border-line bg-surface/96 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
              {description ? (
                <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-line bg-surface-muted p-2 text-ink-soft hover:bg-surface-hover hover:text-ink"
              aria-label="Close detail drawer"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}
