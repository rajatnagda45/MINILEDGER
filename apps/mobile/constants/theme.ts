import { Platform } from 'react-native';

// "Midnight Ledger" — a dark, art-directed fintech palette. Graphite/slate
// surfaces, restrained electric-blue actions, mint success, coral overdue.
export const colors = {
  // Surfaces: deep graphite canvas → slate cards → elevated panels
  canvas: '#10141D',
  canvasLift: '#131925',
  surface: '#191F2B',
  elevated: '#222B3A',
  surfaceHover: '#202838',
  // Text hierarchy on dark
  ink: '#F2F5FA',
  inkSoft: '#A5B0C2',
  muted: '#7F8BA0',
  disabled: '#667187',
  // Separators
  line: '#303A4B',
  lineSoft: '#242D3B',
  // Primary action: electric blue (primaryDark is the lighter on-dark accent)
  // White normal-sized button text reaches WCAG AA on this blue (4.76:1).
  primary: '#496ADF',
  // Hover remains bright while preserving AA contrast with white button text.
  primaryHover: '#4F6FDC',
  primaryPressed: '#3E5BC4',
  primaryDark: '#93A9FF',
  primarySoft: '#1E2A49',
  // Deep brand panel (login product side)
  navy: '#141A26',
  navyLift: '#0B0E15',
  // Semantic: coral overdue, amber warning, mint success — bright on dark,
  // each paired with a subtle tinted-dark surface for chips/badges.
  danger: '#FF7777',
  dangerSoft: '#2C1B1E',
  dangerLine: '#4A2F33',
  warning: '#E6AE57',
  warningSoft: '#2A2418',
  success: '#42D6A4',
  successSoft: '#153026',
  successLine: '#1F4536',
  white: '#FFFFFF',
  scrim: 'rgba(5, 8, 14, 0.66)',
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;
export const radii = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const controls = { compact: 44, touch: 44, default: 54, input: 56 } as const;
export const icons = { sm: 16, md: 20, lg: 24 } as const;

// Motion tokens — short and purposeful for a financial utility.
export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
  // Standard ease-out curve (approximated for RN Animated bezier).
  rise: 10,
} as const;

export const breakpoints = { tablet: 640, desktop: 1024 } as const;

// Shared layout boundaries keep large screens intentional without stretching
// forms and reading surfaces beyond comfortable measures.
export const layout = { pageMax: 1240, readingMax: 720, rail: 340 } as const;

// On a dark UI, depth comes mostly from surface/border contrast; shadows stay
// subtle and are cast with black so they read against graphite.
export const shadow = Platform.select({
  ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.34, shadowRadius: 26 },
  android: { elevation: 4 },
  default: { boxShadow: '0 12px 32px rgba(0, 0, 0, 0.38)' },
});

// Used wherever the browser's native outline is replaced by a themed control.
// Native platforms rely on their accessibility focus treatment.
export const focusRing = Platform.select({
  web: { boxShadow: '0 0 0 3px rgba(147, 169, 255, 0.28)' },
  default: {},
}) ?? {};

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

