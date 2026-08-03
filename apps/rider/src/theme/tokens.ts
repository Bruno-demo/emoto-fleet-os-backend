import { Platform } from 'react-native';

export const theme = {
  colors: {
    // Core surfaces
    background: '#0B0F19',
    backgroundAccent: '#070B14',
    surface: '#0F172A',
    surfaceMuted: '#1E293B',
    surfaceStrong: '#0F172A',
    surfaceRaised: 'rgba(30, 41, 59, 0.65)',

    // Borders
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    borderFaint: 'rgba(255, 255, 255, 0.04)',

    // Text
    text: '#FFFFFF',
    textSecondary: '#A3B3CB',
    textMuted: '#64748B',
    textFaint: '#475569',

    // Primary / accent
    primary: '#3B82F6',
    primaryStrong: '#2563EB',
    primarySoft: 'rgba(59, 130, 246, 0.15)',
    primaryBorder: 'rgba(59, 130, 246, 0.3)',
    primaryGlow: 'rgba(59, 130, 246, 0.08)',

    // Semantic: Success
    success: '#34D399',
    successStrong: '#10B981',
    successSoft: 'rgba(16, 185, 129, 0.15)',
    successBorder: 'rgba(16, 185, 129, 0.3)',

    // Semantic: Warning
    warning: '#FBBF24',
    warningStrong: '#F59E0B',
    warningSoft: 'rgba(245, 158, 11, 0.15)',
    warningBorder: 'rgba(245, 158, 11, 0.3)',

    // Semantic: Danger
    danger: '#FB7185',
    dangerStrong: '#E11D48',
    dangerSoft: 'rgba(225, 29, 72, 0.15)',
    dangerBorder: 'rgba(225, 29, 72, 0.3)',

    // Severity scale
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

    // Feature
    purple: '#A78BFA',
    purpleSoft: 'rgba(167, 139, 250, 0.15)',
    purpleBorder: 'rgba(167, 139, 250, 0.3)',

    // System
    offline: '#FBBF24',
    overlay: 'rgba(0, 0, 0, 0.75)',
    shimmer: 'rgba(255, 255, 255, 0.03)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  layout: {
    screenInset: 16,
    sectionGap: 16,
    cardPadding: 18,
    cardGap: 14,
    itemPaddingX: 16,
    itemPaddingY: 14,
    inlineGap: 12,
    textGap: 6,
  },
  radius: {
    input: 12,
    button: 16,
    card: 20,
    hero: 28,
    pill: 999,
  },
  typography: {
    caption: 11,
    small: 12,
    body: 14,
    emphasis: 15,
    subtitle: 17,
    section: 20,
    hero: 28,
    display: 34,
    lineHeight: {
      caption: 15,
      small: 16,
      body: 20,
      emphasis: 22,
      subtitle: 24,
      section: 26,
      hero: 36,
      display: 42,
    },
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 4,
    },
    web: {
      boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.12)',
    },
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
  }),
  shadowLight: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: {
      elevation: 2,
    },
    web: {
      boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.06)',
    },
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
  }),
} as const;

export const lightTheme = {
  colors: {
    // Core surfaces
    background: '#F8FAFC',
    backgroundAccent: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    surfaceStrong: '#FFFFFF',
    surfaceRaised: 'rgba(241, 245, 249, 0.85)',

    // Borders
    border: 'rgba(0, 0, 0, 0.08)',
    borderStrong: 'rgba(0, 0, 0, 0.15)',
    borderFaint: 'rgba(0, 0, 0, 0.04)',

    // Text
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textFaint: '#CBD5E1',

    // Primary / accent
    primary: '#2563EB',
    primaryStrong: '#1D4ED8',
    primarySoft: 'rgba(37, 99, 235, 0.10)',
    primaryBorder: 'rgba(37, 99, 235, 0.25)',
    primaryGlow: 'rgba(37, 99, 235, 0.06)',

    // Semantic: Success
    success: '#059669',
    successStrong: '#047857',
    successSoft: 'rgba(5, 150, 105, 0.10)',
    successBorder: 'rgba(5, 150, 105, 0.25)',

    // Semantic: Warning
    warning: '#D97706',
    warningStrong: '#B45309',
    warningSoft: 'rgba(217, 119, 6, 0.10)',
    warningBorder: 'rgba(217, 119, 6, 0.25)',

    // Semantic: Danger
    danger: '#E11D48',
    dangerStrong: '#BE123C',
    dangerSoft: 'rgba(225, 29, 72, 0.10)',
    dangerBorder: 'rgba(225, 29, 72, 0.25)',

    // Severity scale
    low: '#64748B',
    lowSoft: 'rgba(100, 116, 139, 0.10)',
    lowBorder: 'rgba(100, 116, 139, 0.25)',
    medium: '#2563EB',
    mediumSoft: 'rgba(37, 99, 235, 0.10)',
    mediumBorder: 'rgba(37, 99, 235, 0.25)',
    high: '#D97706',
    highSoft: 'rgba(217, 119, 6, 0.10)',
    highBorder: 'rgba(217, 119, 6, 0.25)',
    critical: '#E11D48',
    criticalSoft: 'rgba(225, 29, 72, 0.10)',
    criticalBorder: 'rgba(225, 29, 72, 0.25)',

    // Feature
    purple: '#7C3AED',
    purpleSoft: 'rgba(124, 58, 237, 0.10)',
    purpleBorder: 'rgba(124, 58, 237, 0.25)',

    // System
    offline: '#D97706',
    overlay: 'rgba(0, 0, 0, 0.45)',
    shimmer: 'rgba(0, 0, 0, 0.03)',
  },
  spacing: theme.spacing,
  layout: theme.layout,
  radius: theme.radius,
  typography: theme.typography,
  shadow: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
    },
    android: {
      elevation: 3,
    },
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
    },
  }),
  shadowLight: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.03,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    android: {
      elevation: 1,
    },
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.03,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
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
