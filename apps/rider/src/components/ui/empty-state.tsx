import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/tokens';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

// Provides consistent empty-state guidance with a clear next step.
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  action: {
    marginTop: theme.spacing.sm,
    width: '100%',
  },
});
