import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/tokens';
import { PrimaryButton, SecondaryButton } from './button';

interface ErrorStateProps {
  title?: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
  onSecondaryAction?: () => void;
  secondaryLabel?: string;
}

// Provides a reusable error block with retry and fallback actions.
export function ErrorState({
  title = 'Something went wrong',
  description,
  retryLabel = 'Try again',
  onRetry,
  onSecondaryAction,
  secondaryLabel,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {onRetry ? <PrimaryButton label={retryLabel} onPress={onRetry} /> : null}
      {onSecondaryAction && secondaryLabel ? (
        <SecondaryButton label={secondaryLabel} onPress={onSecondaryAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#F1C9C4',
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.dangerSoft,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.section,
    fontWeight: '700',
    color: theme.colors.text,
  },
  description: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
});
