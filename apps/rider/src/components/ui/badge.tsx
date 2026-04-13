import { StyleSheet, Text, View } from 'react-native';
import {
  BadgeTone,
  getBadgeToneColors,
  getScoreTone,
  getSeverityColors,
  ThemeSeverity,
  theme,
} from '../../theme/tokens';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

// Renders compact pill badges for status and score summaries.
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const colors = getBadgeToneColors(tone);
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

// Renders a shared severity badge mapped directly from backend event levels.
export function SeverityBadge({ severity }: { severity: ThemeSeverity }) {
  const colors = getSeverityColors(severity);
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{severity}</Text>
    </View>
  );
}

// Renders a score badge that uses the shared coaching tone scale.
export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const scoreTone = getScoreTone(score);
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: scoreTone.background,
          borderColor: scoreTone.border,
        },
      ]}
    >
      <Text style={[styles.text, { color: scoreTone.text }]}>
        {score === null || score === undefined ? scoreTone.label : `Score ${score.toFixed(1)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    minHeight: 26,
    justifyContent: 'center',
  },
  text: {
    fontSize: theme.typography.small,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
