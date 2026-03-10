import { Badge, type BadgeTone } from '@/components/ui/badge';

export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone?: BadgeTone;
}) {
  return <Badge label={label} tone={tone} size="sm" />;
}
