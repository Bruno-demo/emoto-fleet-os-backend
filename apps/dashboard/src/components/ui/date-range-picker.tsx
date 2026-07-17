'use client';

import { Calendar } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cx, getLocalDateString } from '@/lib/ui';

interface DateRangePickerProps {
  from: string; // ISO date string
  to: string;   // ISO date string
  onChange: (range: { from: string; to: string }) => void;
}

type Preset = '7d' | '14d' | '30d' | 'month' | 'custom';

function toISODate(date: Date): string {
  return getLocalDateString(date);
}

function getPresetRange(preset: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const to = toISODate(now);

  if (preset === '7d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: toISODate(from), to };
  }
  if (preset === '14d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 14);
    return { from: toISODate(from), to };
  }
  if (preset === '30d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: toISODate(from), to };
  }
  // This month
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISODate(from), to };
}

function detectPreset(from: string, to: string): Preset {
  const now = new Date();
  const todayStr = toISODate(now);

  if (to !== todayStr) return 'custom';

  for (const preset of ['7d', '14d', '30d', 'month'] as const) {
    const range = getPresetRange(preset);
    if (range.from === from) return preset;
  }
  return 'custom';
}

const PRESET_LABELS: Array<{ key: Preset; label: string }> = [
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const detectedPreset = useMemo(() => detectPreset(from, to), [from, to]);
  const [showCustom, setShowCustom] = useState(detectedPreset === 'custom');

  const activePreset = useMemo(() => {
    if (showCustom) return 'custom';
    return detectedPreset;
  }, [detectedPreset, showCustom]);

  const handlePreset = (preset: Preset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(getPresetRange(preset));
  };

  return (
    <div className="rounded-2xl border border-line bg-surface-strong p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-400">
          <Calendar size={14} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESET_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePreset(key)}
              className={cx(
                'rounded-xl px-3 py-2 text-xs font-bold transition-all',
                (activePreset === key || (key === 'custom' && showCustom))
                  ? 'bg-accent text-white'
                  : 'border border-line bg-white/5 text-zinc-400 hover:bg-surface-hover hover:text-ink',
              )}
              style={
                (activePreset === key || (key === 'custom' && showCustom))
                  ? { background: '#3B82F6', color: 'white' }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>

        {showCustom && (
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={from}
              onChange={(e) => onChange({ from: e.target.value, to })}
              className="h-8 rounded-lg border border-line bg-surface-strong px-2.5 text-xs text-ink outline-none transition focus:border-accent light dark:[color-scheme:dark]"
            />
            <span className="text-xs text-zinc-500">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => onChange({ from, to: e.target.value })}
              className="h-8 rounded-lg border border-line bg-surface-strong px-2.5 text-xs text-ink outline-none transition focus:border-accent light dark:[color-scheme:dark]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
