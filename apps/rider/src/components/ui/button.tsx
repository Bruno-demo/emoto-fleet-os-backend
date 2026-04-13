import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../theme/tokens';

interface BaseButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'danger';
}

// Renders the primary mobile action with large touch targets and loading feedback.
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'primary',
}: BaseButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        tone === 'danger' ? styles.danger : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading
          ? tone === 'danger'
            ? styles.dangerPressed
            : styles.primaryPressed
          : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.surface} />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

// Renders the secondary mobile action without competing with the primary CTA.
export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: BaseButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading ? styles.secondaryPressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.text} />
      ) : (
        <Text style={styles.secondaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.button,
    paddingHorizontal: theme.spacing.xxl,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    ...theme.shadow,
  },
  primaryPressed: {
    backgroundColor: theme.colors.primaryStrong,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  dangerPressed: {
    backgroundColor: theme.colors.dangerStrong,
  },
  primaryText: {
    color: theme.colors.surface,
    fontSize: theme.typography.emphasis,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondary: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
  },
  secondaryPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  secondaryText: {
    color: theme.colors.text,
    fontSize: theme.typography.emphasis,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.55,
  },
});
