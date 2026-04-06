import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#0B0F19',
    backgroundAccent: '#070B14',
    surface: '#0F172A',
    surfaceMuted: '#1E293B',
    surfaceStrong: '#0F172A',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    text: '#FFFFFF',
    textSecondary: '#A3B3CB',
    textMuted: '#64748B',
    primary: '#3B82F6',
    primaryStrong: '#2563EB',
    primarySoft: 'rgba(59, 130, 246, 0.15)',
    primaryBorder: 'rgba(59, 130, 246, 0.3)',
    success: '#34D399',
    successSoft: 'rgba(16, 185, 129, 0.15)',
    successBorder: 'rgba(16, 185, 129, 0.3)',
    warning: '#FBBF24',
    warningSoft: 'rgba(245, 158, 11, 0.15)',
    warningBorder: 'rgba(245, 158, 11, 0.3)',
    danger: '#FB7185',
    dangerStrong: '#E11D48',
    dangerSoft: 'rgba(225, 29, 72, 0.15)',
    dangerBorder: 'rgba(225, 29, 72, 0.3)',
    low: '#CBD5E1',
    lowSoft: 'rgba(148, 163, 184, 0.15)',
    lowBorder: 'rgba(148, 163, 184, 0.3)',
    medium: '#3B82F6',
    mediumSoft: 'rgba(59, 130, 246, 0.15)',
    mediumBorder: 'rgba(59, 130, 246, 0.3)',
    high: '#FBBF24',
    highSoft: 'rgba(245, 158, 11, 0.15)',
    highBorder: 'rgba(245, 158, 11, 0.3)',
    critical: '#FDA4AF',
    criticalSoft: 'rgba(244, 63, 94, 0.2)',
    criticalBorder: 'rgba(244, 63, 94, 0.4)',
    offline: '#FBBF24',
    overlay: 'rgba(0, 0, 0, 0.7)',
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
