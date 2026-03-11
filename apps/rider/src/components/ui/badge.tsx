import { StyleSheet, Text, View } from 'react-native';
import { getScoreTone, getSeverityColors, ThemeSeverity, theme } from '../../theme/tokens';

interface BadgeProps {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}

// Renders compact pill badges for status and score summaries.
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return (
    <View
      style={[
        styles.base,
        tone === 'primary'
          ? styles.primary
          : tone === 'success'
            ? styles.success
            : tone === 'warning'
              ? styles.warning
              : tone === 'danger'
                ? styles.danger
                : styles.neutral,
      ]}
    >
      <Text
        style={[
          styles.text,
          tone === 'primary'
            ? styles.primaryText
            : tone === 'success'
              ? styles.successText
              : tone === 'warning'
                ? styles.warningText
                : tone === 'danger'
                  ? styles.dangerText
                  : styles.neutralText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// Renders a shared severity badge mapped directly from backend event levels.
export function SeverityBadge({ severity }: { severity: ThemeSeverity }) {
  const colors = getSeverityColors(severity);
  return (
    <View style={[styles.base, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.text }]}>{severity}</Text>
    </View>
  );
}

// Renders a score badge that uses the shared coaching tone scale.
export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const scoreTone = getScoreTone(score);
  return (
    <View style={[styles.base, { backgroundColor: scoreTone.background }]}>
      <Text style={[styles.text, { color: scoreTone.text }]}>
        {score === null || score === undefined ? scoreTone.label : `Score ${score.toFixed(1)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  text: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  neutral: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  neutralText: {
    color: theme.colors.textSecondary,
  },
  primary: {
    backgroundColor: theme.colors.primarySoft,
  },
  primaryText: {
    color: theme.colors.primary,
  },
  success: {
    backgroundColor: theme.colors.successSoft,
  },
  successText: {
    color: theme.colors.success,
  },
  warning: {
    backgroundColor: theme.colors.warningSoft,
  },
  warningText: {
    color: theme.colors.warning,
  },
  danger: {
    backgroundColor: theme.colors.dangerSoft,
  },
  dangerText: {
    color: theme.colors.danger,
  },
});
