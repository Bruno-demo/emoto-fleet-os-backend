import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#EEF4FB',
    backgroundAccent: '#EAF1FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F4F8FD',
    surfaceStrong: '#EAF1FB',
    border: '#D4DEEB',
    borderStrong: '#B9C8DB',
    text: '#102038',
    textSecondary: '#53657E',
    textMuted: '#7D8CA3',
    primary: '#155EEF',
    primaryStrong: '#0F4CD1',
    primarySoft: '#DCE8FF',
    primaryBorder: '#B9C8DB',
    success: '#0F7B44',
    successSoft: '#DDF7E4',
    successBorder: '#BDE4C7',
    warning: '#9A6400',
    warningSoft: '#FFF1CF',
    warningBorder: '#E9D6A6',
    danger: '#B2253A',
    dangerStrong: '#8F1C2E',
    dangerSoft: '#FFE0DF',
    dangerBorder: '#F1B9C2',
    low: '#475569',
    lowSoft: '#EDF2F7',
    lowBorder: '#D4DEEB',
    medium: '#155EEF',
    mediumSoft: '#DCE8FF',
    mediumBorder: '#B9C8DB',
    high: '#9A6400',
    highSoft: '#FFF1CF',
    highBorder: '#E9D6A6',
    critical: '#B2253A',
    criticalSoft: '#FFD7E4',
    criticalBorder: '#F1B9C2',
    offline: '#9A6400',
    overlay: 'rgba(20, 36, 51, 0.24)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 10,
    lg: 14,
    xl: 18,
    xxl: 22,
    xxxl: 28,
  },
  layout: {
    screenInset: 16,
    sectionGap: 14,
    cardPadding: 16,
    cardGap: 12,
    itemPaddingX: 14,
    itemPaddingY: 12,
    inlineGap: 10,
    textGap: 5,
  },
  radius: {
    input: 10,
    button: 16,
    card: 20,
    hero: 28,
    pill: 999,
  },
  typography: {
    caption: 11,
    body: 14,
    emphasis: 15,
    section: 20,
    hero: 28,
    lineHeight: {
      caption: 15,
      body: 20,
      emphasis: 22,
      section: 26,
      hero: 36,
    },
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#142433',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#142433',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
  }),
} as const;

export type ThemeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

// Maps shared badge tones to a balanced background, border, and text treatment.
export function getBadgeToneColors(tone: BadgeTone) {
  if (tone === 'primary') {
    return {
      background: theme.colors.primarySoft,
      border: theme.colors.primaryBorder,
      text: theme.colors.primary,
    };
  }
  if (tone === 'success') {
    return {
      background: theme.colors.successSoft,
      border: theme.colors.successBorder,
      text: theme.colors.success,
    };
  }
  if (tone === 'warning') {
    return {
      background: theme.colors.warningSoft,
      border: theme.colors.warningBorder,
      text: theme.colors.warning,
    };
  }
  if (tone === 'danger') {
    return {
      background: theme.colors.dangerSoft,
      border: theme.colors.dangerBorder,
      text: theme.colors.danger,
    };
  }

  return {
    background: theme.colors.surfaceMuted,
    border: theme.colors.border,
    text: theme.colors.textSecondary,
  };
}

// Maps backend severity values to shared badge colors.
export function getSeverityColors(severity: ThemeSeverity) {
  if (severity === 'CRITICAL') {
    return {
      background: theme.colors.criticalSoft,
      border: theme.colors.criticalBorder,
      text: theme.colors.critical,
    };
  }
  if (severity === 'HIGH') {
    return {
      background: theme.colors.highSoft,
      border: theme.colors.highBorder,
      text: theme.colors.high,
    };
  }
  if (severity === 'MEDIUM') {
    return {
      background: theme.colors.mediumSoft,
      border: theme.colors.mediumBorder,
      text: theme.colors.medium,
    };
  }
  return {
    background: theme.colors.lowSoft,
    border: theme.colors.lowBorder,
    text: theme.colors.low,
  };
}

// Maps score values into coaching-friendly status copy and accent color.
export function getScoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return {
      label: 'No score yet',
      background: theme.colors.surfaceMuted,
      border: theme.colors.border,
      badgeTone: 'neutral' as const,
      text: theme.colors.textSecondary,
    };
  }
  if (score >= 85) {
    return {
      label: 'Strong week',
      background: theme.colors.successSoft,
      border: theme.colors.successBorder,
      badgeTone: 'success' as const,
      text: theme.colors.success,
    };
  }
  if (score >= 70) {
    return {
      label: 'Needs attention',
      background: theme.colors.warningSoft,
      border: theme.colors.warningBorder,
      badgeTone: 'warning' as const,
      text: theme.colors.warning,
    };
  }
  return {
    label: 'High risk',
    background: theme.colors.dangerSoft,
    border: theme.colors.dangerBorder,
    badgeTone: 'danger' as const,
    text: theme.colors.danger,
  };
}
