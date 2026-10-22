import { Platform } from 'react-native';

export const colors = {
  canvas: '#F4F6FA',
  surface: '#FFFFFF',
  ink: '#111827',
  inkSoft: '#4B5565',
  muted: '#758195',
  line: '#E4E8F0',
  primary: '#2E63F6',
  primaryDark: '#1743BD',
  primarySoft: '#EAF0FF',
  navy: '#101D37',
  navyLift: '#17294B',
  danger: '#D83B4B',
  dangerSoft: '#FFF0F1',
  warning: '#A95E00',
  warningSoft: '#FFF7E8',
  success: '#16845B',
  successSoft: '#E9F8F1',
  white: '#FFFFFF',
  scrim: 'rgba(15, 23, 42, 0.46)',
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;
export const radii = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

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

