import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/tokens';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

// Standardizes section headings so screens share the same content rhythm.
export function SectionHeader({ title, subtitle, rightSlot }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? <View>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.section,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.body,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
});
