'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';
import { cx } from '@/lib/ui';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Standardizes destructive and safety-critical confirmations across dashboard flows.
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center px-4 animate-fade-in"
      style={{ animationDuration: '150ms' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl border border-line bg-background shadow-[var(--shadow-strong)] animate-scale-in"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-6 pb-5">
          {/* Icon + content */}
          <div className="flex items-start gap-3.5">
            <span
              className={cx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                tone === 'danger'
                  ? 'bg-danger-soft text-danger-ink'
                  : 'bg-warning-soft text-warning-ink',
              )}
            >
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{description}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line bg-surface-muted px-4 py-2 text-[13px] font-semibold text-ink-soft hover:bg-surface-hover hover:text-ink transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={cx(
              'rounded-xl px-4 py-2 text-[13px] font-semibold text-ink transition-colors disabled:opacity-50',
              tone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-accent hover:bg-accent-strong',
            )}
          >
            {isSubmitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
