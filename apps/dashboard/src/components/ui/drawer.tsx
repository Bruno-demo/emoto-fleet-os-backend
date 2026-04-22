'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
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
  const panelRef = useRef<HTMLElement>(null);

  // Allows keyboard users to close the drawer quickly with Escape.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Trap scroll to the drawer when open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div
      className={cx(
        'fixed inset-0 z-[1100] transition-all duration-300',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={cx(
          'absolute inset-0 bg-black/15 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        className={cx(
          'dashboard-scrollbar absolute right-0 top-0 flex h-full flex-col overflow-y-auto border-l border-line bg-background shadow-[var(--shadow-strong)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          size === 'lg' ? 'w-full max-w-[34rem]' : 'w-full max-w-[28rem]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-transparent px-5 py-4">
          <div className="min-w-0 pt-0.5">
            <h2 className="truncate font-display text-base font-bold text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-faint hover:bg-white/10 hover:text-ink transition-colors"
            aria-label="Close detail drawer"
          >
            <X size={15} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}
