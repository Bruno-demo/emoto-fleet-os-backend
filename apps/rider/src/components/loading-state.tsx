import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/tokens';

interface LoadingStateProps {
  message?: string;
}

// Renders a centered loading indicator for full-screen async states.
export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.title}>Hold on</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxl,
    backgroundColor: theme.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  title: {
    fontSize: theme.typography.section,
    fontWeight: '700',
    color: theme.colors.text,
  },
  message: {
    fontSize: theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
