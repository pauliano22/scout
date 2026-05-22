import { Platform } from 'react-native';

export const colors = {
  // Brand
  red: '#B31B1B',
  redSoft: '#A32424',
  redDim: '#F5E4E4',

  // Backgrounds — warm off-white
  background: '#FAFAF8',
  backgroundElevated: '#F4F4F1',
  surface: '#FFFFFF',
  surfaceMuted: '#F8F8F6',

  // Text — near-black down to muted
  textPrimary: '#111111',
  textSecondary: '#3F3F46',
  textTertiary: '#6B7280',
  textDisabled: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Borders — soft
  border: '#E5E7EB',
  borderLight: '#EEEEEC',
  borderHairline: '#F0F0EE',

  // States
  success: '#16A34A',
  successLight: '#E7F5EC',
  warning: '#CA8A04',
  warningLight: '#FEF9C3',
  error: '#C53030',
  errorLight: '#FCEBEB',

  // Status pipeline — neutral → amber (in progress) → green (outcome).
  // Accent is reserved for actions, so statuses use only neutrals + semantics.
  statusSaved: '#6B7280',
  statusSavedBg: '#F1F1EE',
  statusDrafted: '#3F3F46',
  statusDraftedBg: '#EAEAE6',
  statusContacted: '#B0820B',
  statusContactedBg: '#FAF3D6',
  statusReplied: '#16834A',
  statusRepliedBg: '#DDF1E6',
  statusMeeting: '#0F7A3D',
  statusMeetingBg: '#D2EFDC',

  // Swipe — pass is neutral, save is brand
  swipePass: '#9CA3AF',
  swipePassBg: '#F1F1EE',
  swipeSave: '#B31B1B',
  swipeSaveBg: '#FAEAEA',

  // Tab bar
  tabActive: '#111111',
  tabInactive: '#A1A1AA',
  tabBackground: 'rgba(255,255,255,0.96)',
  tabBorder: '#EEEEEC',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  full: 9999,
};

export const shadows = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#0A0A0A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    },
    android: { elevation: 1 },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#0A0A0A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
    },
    android: { elevation: 2 },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#0A0A0A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 20,
    },
    android: { elevation: 4 },
  }),
  card: Platform.select({
    ios: {
      shadowColor: '#0A0A0A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
    },
    android: { elevation: 6 },
  }),
};

export const typography = {
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.68,
    color: colors.textPrimary,
  },
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.56,
    color: colors.textPrimary,
  },
  title2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.44,
    color: colors.textPrimary,
  },
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: -0.41,
    lineHeight: 25,
    color: colors.textPrimary,
  },
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.32,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.24,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: -0.08,
    color: colors.textTertiary,
  },
  caption1: {
    fontSize: 12,
    fontWeight: '400' as const,
    letterSpacing: 0,
    color: colors.textTertiary,
  },
  caption2: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.06,
    color: colors.textTertiary,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.0,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
  },
};

export const cards = {
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    ...shadows.md,
  },
  flat: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
};

export const buttons = {
  primary: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryText: {
    ...typography.headline,
    color: colors.textInverse,
    fontWeight: '600' as const,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    ...typography.headline,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ghostText: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
};

const theme = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  cards,
  buttons,
};

export default theme;
