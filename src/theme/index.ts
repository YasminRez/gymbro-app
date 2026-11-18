/**
 * Tokens de design do GymBrô — espelham as variáveis do protótipo no Figma
 * (página "Identidade visual"). Altere aqui e o app inteiro acompanha.
 */

export const colors = {
  bg: {
    base: '#0B0B0B',
    surface: '#131313',
    elevated: '#1B1B1B',
    input: '#252525',
  },
  border: {
    default: '#2E2E2E',
    strong: '#404040',
  },
  text: {
    primary: '#ECECEC',
    secondary: '#B3B3B3',
    muted: '#737373',
  },
  brand: {
    red: '#BE5049', // ação (botões, curtir)
    redDark: '#9E3F39',
    green: '#6BAF8A', // conquista (match, check-in, sequência)
    greenDark: '#548F6F',
  },
  white: '#FFFFFF',
} as const;

/** Nomes das fontes carregadas em src/app/_layout.tsx */
export const fonts = {
  archivoBlack: 'Archivo_900Black',
  archivoExtraBold: 'Archivo_800ExtraBold',
  archivoBold: 'Archivo_700Bold',
  interRegular: 'Inter_400Regular',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const;

/** Estilos de texto do Figma */
export const typography = {
  displayXL: { fontFamily: fonts.archivoBlack, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  h1: { fontFamily: fonts.archivoExtraBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.archivoBold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fonts.archivoBold, fontSize: 18, lineHeight: 24 },
  bodyLarge: { fontFamily: fonts.interRegular, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.interRegular, fontSize: 14, lineHeight: 20 },
  labelButton: { fontFamily: fonts.interSemiBold, fontSize: 16, lineHeight: 20 },
  labelSmall: { fontFamily: fonts.interSemiBold, fontSize: 13, lineHeight: 16 },
  caption: { fontFamily: fonts.interRegular, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: fonts.interBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export type TypographyVariant = keyof typeof typography;
