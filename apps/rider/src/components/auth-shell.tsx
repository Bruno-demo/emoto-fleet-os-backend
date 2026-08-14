import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './screen-container';
import { useLanguage } from '../lib/i18n/language-context';
import { theme } from '../theme/tokens';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

// Wraps unauthenticated screens in a consistent rider auth layout with an interactive language picker.
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  const { locale, setLocale } = useLanguage();

  return (
    <ScreenContainer>
      {/* Top Header with Language Selector */}
      <View style={styles.topBar}>
        <View style={styles.langPickerContainer}>
          <Pressable
            style={[
              styles.langOption,
              locale === 'en' && styles.langOptionActive,
            ]}
            onPress={() => void setLocale('en')}
            accessibilityRole="button"
            accessibilityLabel="Switch to English"
          >
            <Text
              style={[
                styles.langOptionText,
                locale === 'en' && styles.langOptionTextActive,
              ]}
            >
              🇬🇧 English
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.langOption,
              locale === 'rw' && styles.langOptionActive,
            ]}
            onPress={() => void setLocale('rw')}
            accessibilityRole="button"
            accessibilityLabel="Guhindura mu Kinyarwanda"
          >
            <Text
              style={[
                styles.langOptionText,
                locale === 'rw' && styles.langOptionTextActive,
              ]}
            >
              🇷🇼 Kinyarwanda
            </Text>
          </Pressable>
        </View>
      </View>

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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.xs,
  },
  langPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  langOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  langOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  langOptionText: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  langOptionTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  hero: {
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    borderRadius: theme.radius.hero,
    backgroundColor: theme.colors.backgroundAccent,
    padding: theme.spacing.xxl,
    gap: theme.spacing.sm,
    ...theme.shadow,
  },
  eyebrow: {
    fontSize: theme.typography.small,
    fontWeight: '800',
    letterSpacing: 1.5,
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
    marginTop: theme.spacing.xs,
  },
});
