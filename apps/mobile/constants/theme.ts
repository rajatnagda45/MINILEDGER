import { Platform } from 'react-native';

export const colors = {
  // Surfaces: warm porcelain page, white cards
  canvas: '#F7F6F2',
  surface: '#FFFFFF',
  // Text hierarchy: deep ink navy → secondary slate
  ink: '#172033',
  inkSoft: '#3E4759',
  muted: '#647087',
  line: '#E1E5ED',
  // Primary action: cobalt
  primary: '#355CF5',
  primaryDark: '#2443C8',
  primarySoft: '#E9EEFF',
  // Identity surfaces
  navy: '#14213D',
  navyLift: '#0B1428',
  // Semantic: coral danger, amber warning, mint success
  danger: '#C74747',
  dangerSoft: '#FCEAEA',
  warning: '#B86E16',
  warningSoft: '#FFF2DB',
  success: '#16866A',
  successSoft: '#E5F5EF',
  white: '#FFFFFF',
  scrim: 'rgba(11, 20, 40, 0.46)',
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;
export const radii = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

// Motion tokens — short and purposeful for a financial utility.
export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
  // Standard ease-out curve (approximated for RN Animated bezier).
  rise: 10,
} as const;

export const breakpoints = { tablet: 640, desktop: 1024 } as const;

export const shadow = Platform.select({
  ios: { shadowColor: '#0F1E3A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 24 },
  android: { elevation: 3 },
  default: { boxShadow: '0 10px 30px rgba(15, 30, 58, 0.08)' },
});

export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -1.1 },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.7 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.15 },
  micro: { fontSize: 10, lineHeight: 13, fontWeight: '700' as const, letterSpacing: 0.7 },
} as const;

