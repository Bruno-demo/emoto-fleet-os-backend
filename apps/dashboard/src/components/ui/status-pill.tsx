export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneClass = {
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    info: 'bg-sky-100 text-sky-700',
  }[tone ?? 'neutral'];

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}
