import type { KeyboardTypeOptions, TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../theme/tokens';

interface InputFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
}

// Standardizes mobile text inputs with readable labels and inline errors.
export function InputField({ label, hint, error, ...props }: InputFieldProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <TextInput
        {...props}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          props.multiline ? styles.inputMultiline : null,
          error ? styles.inputError : null,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  hint: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.emphasis,
    color: theme.colors.text,
  },
  inputMultiline: {
    minHeight: 112,
    paddingTop: theme.spacing.lg,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  error: {
    fontSize: theme.typography.caption,
    color: theme.colors.danger,
    fontWeight: '600',
  },
});
