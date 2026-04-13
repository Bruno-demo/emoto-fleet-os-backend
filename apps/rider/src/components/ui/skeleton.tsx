import { useEffect, useRef } from 'react';
import type { DimensionValue } from 'react-native';
import { Animated, StyleSheet, View } from 'react-native';
import { theme } from '../../theme/tokens';

interface SkeletonBlockProps {
  height: number;
  width?: DimensionValue;
  radius?: number;
}

// Renders lightweight placeholder blocks with a subtle shimmer pulse.
export function SkeletonBlock({
  height,
  width = '100%',
  radius = theme.radius.button,
}: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { height, width, borderRadius: radius, opacity }]} />;
}

// Builds stacked placeholders for loading list-based screens.
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={`list-skeleton-${index}`} style={styles.row}>
          <SkeletonBlock height={16} width="52%" />
          <SkeletonBlock height={12} width="84%" />
          <SkeletonBlock height={12} width="42%" />
        </View>
      ))}
    </View>
  );
}

// Builds compact card placeholders for score and summary surfaces.
export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBlock height={14} width="38%" />
      <SkeletonBlock height={30} width="55%" />
      <SkeletonBlock height={12} width="70%" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: theme.colors.surfaceStrong,
  },
  stack: {
    gap: theme.spacing.md,
  },
  row: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
});
