import { StyleSheet, Text, View } from 'react-native';
import { getScoreTone, theme } from '../../theme/tokens';

interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
}

export function ScoreRing({ score, size = 120 }: ScoreRingProps) {
  const scoreTone = getScoreTone(score);
  const progress = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const ringWidth = Math.max(5, Math.round(size * 0.06));

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: scoreTone.border,
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: size - ringWidth * 2 - 8,
            height: size - ringWidth * 2 - 8,
            borderRadius: (size - ringWidth * 2 - 8) / 2,
            backgroundColor: scoreTone.background,
          },
        ]}
      >
        <Text style={[styles.scoreValue, { color: scoreTone.text, fontSize: Math.round(size * 0.28) }]}>
          {score === null || score === undefined ? '--' : progress}
        </Text>
        <Text style={styles.scoreLabel}>
          {score === null || score === undefined ? 'No data' : 'SCORE'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreValue: {
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
