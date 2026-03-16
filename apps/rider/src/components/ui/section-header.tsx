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
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
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
    gap: theme.layout.inlineGap,
  },
  textWrap: {
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
});
