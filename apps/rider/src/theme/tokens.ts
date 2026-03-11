import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F4F6F8',
    backgroundAccent: '#EEF3F6',
    surface: '#FFFFFF',
    surfaceMuted: '#F6F8FA',
    surfaceStrong: '#E7EDF2',
    border: '#D7E0E7',
    borderStrong: '#C4CFD8',
    text: '#142433',
    textSecondary: '#526474',
    textMuted: '#708394',
    primary: '#215E91',
    primaryStrong: '#1A4A72',
    primarySoft: '#E9F1F7',
    primaryBorder: '#C7D9E8',
    success: '#1D7A5A',
    successSoft: '#ECF6F1',
    successBorder: '#C9E4D8',
    warning: '#9A6A1B',
    warningSoft: '#FBF2E4',
    warningBorder: '#E8D3AF',
    danger: '#A94A39',
    dangerStrong: '#8C3B2E',
    dangerSoft: '#F8ECE8',
    dangerBorder: '#E9C9C2',
    low: '#66788A',
    lowSoft: '#EEF2F5',
    lowBorder: '#D7E0E7',
    medium: '#215E91',
    mediumSoft: '#E9F1F7',
    mediumBorder: '#C7D9E8',
    high: '#9A6A1B',
    highSoft: '#FBF2E4',
    highBorder: '#E8D3AF',
    critical: '#A94A39',
    criticalSoft: '#F8ECE8',
    criticalBorder: '#E9C9C2',
    offline: '#A26C1A',
    overlay: 'rgba(20, 36, 51, 0.24)',
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
  radius: {
    input: 12,
    button: 18,
    card: 24,
    hero: 32,
    pill: 999,
  },
  typography: {
    caption: 12,
    body: 14,
    emphasis: 16,
    section: 20,
    hero: 28,
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
