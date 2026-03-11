import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F3F6F7',
    backgroundAccent: '#E7EFFA',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF3F6',
    surfaceStrong: '#E3EBF0',
    border: '#D5DEE5',
    borderStrong: '#BCC8D2',
    text: '#102033',
    textSecondary: '#425466',
    textMuted: '#667B8F',
    primary: '#1765F3',
    primaryStrong: '#0E4FCC',
    primarySoft: '#E8F0FF',
    success: '#0F8A63',
    successSoft: '#EAF7F1',
    warning: '#B77400',
    warningSoft: '#FFF2D8',
    danger: '#C23A2B',
    dangerSoft: '#FCE7E4',
    low: '#64748B',
    lowSoft: '#EEF2F6',
    medium: '#1765F3',
    mediumSoft: '#E8F0FF',
    high: '#B77400',
    highSoft: '#FFF2D8',
    critical: '#C23A2B',
    criticalSoft: '#FCE7E4',
    offline: '#D97706',
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
      shadowColor: '#102033',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 3,
    },
    default: {
      shadowColor: '#102033',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
  }),
} as const;

export type ThemeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Maps backend severity values to shared badge colors.
export function getSeverityColors(severity: ThemeSeverity) {
  if (severity === 'CRITICAL') {
    return { background: theme.colors.criticalSoft, text: theme.colors.critical };
  }
  if (severity === 'HIGH') {
    return { background: theme.colors.highSoft, text: theme.colors.high };
  }
  if (severity === 'MEDIUM') {
    return { background: theme.colors.mediumSoft, text: theme.colors.medium };
  }
  return { background: theme.colors.lowSoft, text: theme.colors.low };
}

// Maps score values into coaching-friendly status copy and accent color.
export function getScoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return {
      label: 'No score yet',
      background: theme.colors.surfaceMuted,
      text: theme.colors.textSecondary,
    };
  }
  if (score >= 85) {
    return {
      label: 'Strong week',
      background: theme.colors.successSoft,
      text: theme.colors.success,
    };
  }
  if (score >= 70) {
    return {
      label: 'Needs attention',
      background: theme.colors.warningSoft,
      text: theme.colors.warning,
    };
  }
  return {
    label: 'High risk',
    background: theme.colors.dangerSoft,
    text: theme.colors.danger,
  };
}
