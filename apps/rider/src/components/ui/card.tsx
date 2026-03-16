import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/tokens';

interface AppCardProps {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
}

// Wraps rider content in a consistent high-contrast card surface.
export function AppCard({ title, subtitle, rightSlot, children }: AppCardProps) {
  return (
    <View style={styles.card}>
      {title || subtitle || rightSlot ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {rightSlot ? <View>{rightSlot}</View> : null}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    padding: theme.layout.cardPadding,
    gap: theme.layout.cardGap,
    ...theme.shadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.layout.inlineGap,
  },
  headerText: {
    flex: 1,
    gap: theme.layout.textGap,
  },
  title: {
    fontSize: theme.typography.section,
    lineHeight: theme.typography.lineHeight.section,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.textSecondary,
  },
  body: {
    gap: theme.layout.inlineGap,
  },
});
