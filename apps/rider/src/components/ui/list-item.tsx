import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/tokens';

interface ListItemProps {
  title: string;
  subtitle?: string;
  meta?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  onPress?: () => void;
}

// Standardizes list rows for trips, POIs, alerts, and detail summaries.
export function ListItem({
  title,
  subtitle,
  meta,
  leftSlot,
  rightSlot,
  onPress,
}: ListItemProps) {
  const content = (
    <View style={styles.container}>
      {leftSlot ? <View style={styles.leftSlot}>{leftSlot}</View> : null}
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {rightSlot ? <View>{rightSlot}</View> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={styles.card}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.layout.itemPaddingX,
    paddingVertical: theme.layout.itemPaddingY,
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  container: {
    flexDirection: 'row',
    gap: theme.layout.inlineGap,
  },
  leftSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: theme.layout.textGap,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.layout.inlineGap,
  },
  title: {
    flex: 1,
    fontSize: theme.typography.emphasis,
    lineHeight: theme.typography.lineHeight.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.textSecondary,
  },
  meta: {
    fontSize: theme.typography.caption,
    lineHeight: theme.typography.lineHeight.caption,
    color: theme.colors.textMuted,
  },
});
