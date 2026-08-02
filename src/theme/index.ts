/**
 * Design tokens — calm, premium, domestic. Warm off-white surfaces, deep
 * charcoal-navy text, muted blue-green accent. All screens draw from here.
 */
export const colors = {
  // Surfaces
  background: '#FAF8F4', // warm off-white
  surface: '#FFFFFF',
  surfaceMuted: '#F1EEE7',
  border: '#E4E0D6',
  // Text
  text: '#22303C', // deep charcoal-navy
  textSecondary: '#5B6770',
  textMuted: '#8A939B',
  onAccent: '#FFFFFF',
  // Accent — muted blue-green (teal slate)
  accent: '#2F6D68',
  accentSoft: '#E3EEEC',
  accentPressed: '#245450',
  // Semantic
  danger: '#A94436',
  dangerSoft: '#F6E7E4',
  warning: '#8A6D1F',
  warningSoft: '#F5EDD8',
  success: '#3A6B4F',
  successSoft: '#E4EFE8',
  info: '#3D5A80',
  infoSoft: '#E5EBF2',
  // Misc
  overlay: 'rgba(24, 32, 38, 0.5)',
  focus: '#2F6D68',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  largeTitle: { fontSize: 30, fontWeight: '700' as const, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 23 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 23 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  captionMedium: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  small: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
} as const;

/** Minimum touch target size per Apple HIG. */
export const touchTarget = 44;

export const shadows = {
  card: {
    shadowColor: '#22303C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
