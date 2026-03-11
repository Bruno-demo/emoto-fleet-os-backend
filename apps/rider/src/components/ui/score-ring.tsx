import { StyleSheet, Text, View } from 'react-native';
import { getScoreTone, theme } from '../../theme/tokens';

interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
}

// Renders a lightweight score ring without adding SVG or chart dependencies.
export function ScoreRing({ score, size = 120 }: ScoreRingProps) {
  const scoreTone = getScoreTone(score);
  const progress = Math.max(0, Math.min(100, Math.round(score ?? 0)));

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: scoreTone.border,
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: size - 22,
            height: size - 22,
            borderRadius: (size - 22) / 2,
            backgroundColor: scoreTone.background,
          },
        ]}
      >
        <Text style={[styles.scoreValue, { color: scoreTone.text }]}>
          {score === null || score === undefined ? '--' : progress}
        </Text>
        <Text style={styles.scoreLabel}>{scoreTone.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 7,
    backgroundColor: theme.colors.surfaceMuted,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
