import { useWindowDimensions } from 'react-native';

/**
 * Breakpoints that drive *composition*, not just font size. The original app
 * capped every screen at a fixed maxWidth and centred it, which rendered as a
 * narrow strip on wide desktop viewports. These breakpoints let each screen
 * reflow its layout (split columns, wider shells) above the given widths while
 * staying a natural single column on phones.
 */
export const breakpoints = { tablet: 640, desktop: 1024 } as const;

export interface Responsive {
  width: number;
  isTablet: boolean;
  isDesktop: boolean;
  /** True once the viewport is wide enough for the two-column login/dashboard. */
  isWide: boolean;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isTablet = width >= breakpoints.tablet;
  const isDesktop = width >= breakpoints.desktop;
  return { width, isTablet, isDesktop, isWide: width >= 900 };
}
