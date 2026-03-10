'use client';

import { AlertTriangle } from 'lucide-react';

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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-[var(--radius-panel)] border border-line bg-surface p-6 shadow-[var(--shadow-strong)]"
      >
        <div className="flex items-start gap-4">
          <span
            className={`rounded-2xl p-3 ${
              tone === 'danger'
                ? 'bg-danger-soft text-danger-ink'
                : 'bg-warning-soft text-warning-ink'
            }`}
          >
            <AlertTriangle size={20} />
          </span>
          <div>
            <h3 className="font-display text-2xl font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius-control)] border border-line bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-hover"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`rounded-[var(--radius-control)] px-4 py-3 text-sm font-semibold text-white ${
              tone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'
                : 'bg-accent hover:bg-accent-strong disabled:bg-blue-300'
            }`}
          >
            {isSubmitting ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
