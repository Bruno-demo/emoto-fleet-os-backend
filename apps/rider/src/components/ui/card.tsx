import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/tokens';

interface AppCardProps {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'accent';
}

export function AppCard({ title, subtitle, rightSlot, children, tone = 'default' }: AppCardProps) {
  return (
    <View style={[styles.card, tone === 'accent' ? styles.cardAccent : null]}>
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
          {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
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
  cardAccent: {
    borderColor: theme.colors.primaryBorder,
    backgroundColor: theme.colors.primaryGlow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.layout.inlineGap,
  },
  headerText: {
    flex: 1,
    gap: theme.layout.textGap,
  },
  rightSlot: {
    alignSelf: 'center',
  },
  title: {
    fontSize: theme.typography.subtitle,
    lineHeight: theme.typography.lineHeight.subtitle,
    fontWeight: '800',
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
