import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './screen-container';
import { theme } from '../theme/tokens';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

// Wraps unauthenticated screens in a consistent rider auth layout.
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {children}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.hero,
    backgroundColor: theme.colors.backgroundAccent,
    padding: theme.spacing.xl,
    gap: theme.layout.textGap,
  },
  eyebrow: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.primary,
  },
  title: {
    fontSize: theme.typography.hero,
    lineHeight: theme.typography.lineHeight.hero,
    fontWeight: '800',
    color: theme.colors.text,
  },
  description: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.textSecondary,
  },
});
