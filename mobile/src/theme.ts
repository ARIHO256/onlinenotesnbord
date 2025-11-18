export type Theme = {
  colors: {
    background: string;
    backgroundAlt: string;
    card: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    muted: string;
    border: string;
    shadow: string;
    primary: string;
    primaryContrast: string;
    accent: string;
    accentContrast: string;
    success: string;
    warning: string;
    danger: string;
  };
  spacing: typeof spacing;
  typography: typeof typography;
  fonts: {
    regular: string;
    semibold: string;
    title: string;
  };
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const typography = {
  title: 22,
  subtitle: 16,
  body: 14,
};

export const lightTheme: Theme = {
  colors: {
    background: '#F5F6FB',
    backgroundAlt: '#E7EBF7',
    card: '#FFFFFF',
    surface: '#EEF2FF',
    surfaceMuted: '#F8FAFC',
    text: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    shadow: 'rgba(15,23,42,0.12)',
    primary: '#4338CA',
    primaryContrast: '#FFFFFF',
    accent: '#F97316',
    accentContrast: '#FFF7ED',
    success: '#22C55E',
    warning: '#FBBF24',
    danger: '#EF4444',
  },
  spacing,
  typography,
  fonts: {
    regular: 'Inter_400Regular',
    semibold: 'Inter_600SemiBold',
    title: 'Domine_700Bold',
  },
};

export const darkTheme: Theme = {
  colors: {
    background: '#050816',
    backgroundAlt: '#0B1224',
    card: '#111729',
    surface: '#1E293B',
    surfaceMuted: '#0F172A',
    text: '#F8FAFC',
    muted: '#94A3B8',
    border: '#273248',
    shadow: 'rgba(3,7,18,0.7)',
    primary: '#818CF8',
    primaryContrast: '#0B1224',
    accent: '#F97316',
    accentContrast: '#311604',
    success: '#4ADE80',
    warning: '#FDE68A',
    danger: '#F87171',
  },
  spacing,
  typography,
  fonts: {
    regular: 'Inter_400Regular',
    semibold: 'Inter_600SemiBold',
    title: 'Domine_700Bold',
  },
};

