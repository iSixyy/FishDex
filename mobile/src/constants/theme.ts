/** Sistema de diseño de FishDex: TODA la app es "el aparato".
 *
 * Cada pantalla es una Pokédex marina (ver `DexScreen`): carcasa con lente y
 * LEDs arriba, y el contenido dentro de una pantalla LCD enmarcada. Letra
 * pixelada en todo (Press Start 2P para títulos y botones, VT323 para textos),
 * bordes gruesos, esquinas casi rectas y "relieve" pixel (borde inferior más
 * grueso) en tarjetas y botones. La acción principal es el botón rojo.
 *
 * - Claro ("Dex clásica"): carcasa azul océano y LCD verde de consola.
 * - Oscuro ("Dex nocturna"): carcasa azul marino y LCD retroiluminada azul
 *   con texto crema. */

export interface ThemeColors {
  /** Carcasa del aparato (fondo detrás de la pantalla LCD). */
  shell: string;
  shellDark: string;
  shellLight: string;
  /** Texto e iconos sobre la carcasa. */
  shellText: string;
  shellTextMuted: string;
  /** Marco claro alrededor de la pantalla LCD. */
  bezel: string;

  /** Fondo de la pantalla LCD: donde vive el contenido de cada pantalla. */
  background: string;
  /** Tarjetas y campos sobre la LCD. */
  surface: string;
  /** Rellenos secundarios (chips inactivos, huecos de imagen). */
  surfaceAlt: string;
  /** Panel "invertido" (tarjeta héroe): extremos del degradado y textos. */
  heroStart: string;
  heroEnd: string;
  heroText: string;
  heroTextMuted: string;

  /** Líneas y bordes (gruesos, color de tinta). */
  border: string;
  borderStrong: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  /** Tinta: selección activa, chips marcados, avatares, pines. */
  primary: string;
  onPrimary: string;
  /** Botón de acción principal (el botón rojo de la Pokédex). */
  cta: string;
  ctaDark: string;
  onCta: string;
  /** Acento azul para enlaces y progresos. */
  accent: string;
  accentSoft: string;

  success: string;
  danger: string;
  warning: string;
  gold: string;

  /** Siempre claros: texto sobre fotografía. */
  textOnDark: string;
  textOnDarkMuted: string;

  scrim: string;
  scrimStrong: string;

  /** Barra de estado del sistema acorde a la carcasa. */
  statusBar: "light" | "dark";
}

export const lightColors: ThemeColors = {
  shell: "#1C4F86",
  shellDark: "#123760",
  shellLight: "#2C6BAD",
  shellText: "#FFFFFF",
  shellTextMuted: "rgba(255,255,255,0.72)",
  bezel: "#E8EEF3",

  background: "#CFE3C2",
  surface: "#E2EFDA",
  surfaceAlt: "#B7D0A6",
  heroStart: "#1E2C1C",
  heroEnd: "#2F4A2C",
  heroText: "#D3E6C7",
  heroTextMuted: "rgba(211,230,199,0.72)",

  border: "#1E2C1C",
  borderStrong: "#1E2C1C",

  textPrimary: "#1E2C1C",
  textSecondary: "#3B5636",
  textMuted: "#5E7757",

  primary: "#1E2C1C",
  onPrimary: "#D3E6C7",
  cta: "#E4572E",
  ctaDark: "#9E3417",
  onCta: "#FFFFFF",
  accent: "#1C4F86",
  accentSoft: "#BCD5E4",

  success: "#2F7D32",
  danger: "#C0392B",
  warning: "#B7791F",
  gold: "#B8860B",

  textOnDark: "#FFFFFF",
  textOnDarkMuted: "rgba(255,255,255,0.72)",

  scrim: "rgba(8,24,42,0.55)",
  scrimStrong: "rgba(8,24,42,0.82)",
  statusBar: "light",
};

export const darkColors: ThemeColors = {
  shell: "#0B1A2E",
  shellDark: "#050E1A",
  shellLight: "#1A365A",
  shellText: "#F4EBDC",
  shellTextMuted: "rgba(244,235,220,0.68)",
  bezel: "#1C2A40",

  background: "#14233A",
  surface: "#1B2E4B",
  surfaceAlt: "#24395C",
  heroStart: "#F1E4CC",
  heroEnd: "#D9C7A4",
  heroText: "#0F1826",
  heroTextMuted: "rgba(15,24,38,0.66)",

  border: "#7D8FAE",
  borderStrong: "#A9B8D0",

  textPrimary: "#F4EBDC",
  textSecondary: "#C8BEAD",
  textMuted: "#8F9BB0",

  primary: "#F1E4CC",
  onPrimary: "#0F1826",
  cta: "#E4572E",
  ctaDark: "#8E2F15",
  onCta: "#FFFFFF",
  accent: "#8DB9E0",
  accentSoft: "#223E62",

  success: "#6CC49A",
  danger: "#EF7F6C",
  warning: "#E8BE62",
  gold: "#E3C069",

  textOnDark: "#F4EBDC",
  textOnDarkMuted: "rgba(244,235,220,0.72)",

  scrim: "rgba(3,8,16,0.6)",
  scrimStrong: "rgba(3,8,16,0.85)",
  statusBar: "light",
};

/** Paleta fija del aparato para piezas que se exportan como imagen (la
 * tarjeta de compartir), que deben verse igual con cualquier tema. */
export const dex = {
  shell: "#1C4F86",
  shellDark: "#123760",
  shellLight: "#2C6BAD",
  hinge: "#0E2C4D",
  lens: "#56C7F0",
  lensRing: "#E9F6FB",
  ledRed: "#E4572E",
  ledYellow: "#F3C13A",
  ledGreen: "#76C04E",
  screen: "#D3E6C7",
  screenDark: "#B9D3A9",
  screenText: "#1E2C1C",
  screenMuted: "#56704F",
  screenBorder: "#0B2138",
  locked: "#8FA887",
} as const;

/** Respaldo si `/config` no está disponible (offline). */
export const FALLBACK_RARITY_COLORS: Record<string, string> = {
  COMMON: "#8B9891",
  UNCOMMON: "#4C9A72",
  RARE: "#3E7FB8",
  EPIC: "#7D5BA6",
  LEGENDARY: "#D9A036",
  MYTHIC: "#C0503F",
};

/** Colores de los niveles de logro. */
export const TIER_COLORS: Record<string, string> = {
  BRONZE: "#B0764A",
  SILVER: "#8E99A6",
  GOLD: "#C99A1E",
};

/** Colores de las insignias de temporada (por puesto). */
export const SEASON_TIER_COLORS: Record<string, string> = {
  CHAMPION: TIER_COLORS.GOLD,
  PODIUM: TIER_COLORS.SILVER,
  TOP10: TIER_COLORS.BRONZE,
  PARTICIPANT: "#4F8A5B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
} as const;

/** Esquinas casi rectas: estética de consola. `full` queda para círculos. */
export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 999,
} as const;

/** Grosor de línea común (bordes de tarjetas, botones y campos). */
export const BORDER = 2;

/** Todas las familias son pixeladas. Los alias `sans*` se conservan para no
 * romper estilos existentes: los "normales" van a VT323 (legible) y los
 * "negritas" a Press Start 2P (titulares). */
export const fonts = {
  pixel: "PressStart2P_400Regular",
  pixelBody: "VT323_400Regular",
  sans: "VT323_400Regular",
  sansMedium: "VT323_400Regular",
  sansSemi: "PressStart2P_400Regular",
  sansBold: "PressStart2P_400Regular",
  sansHeavy: "PressStart2P_400Regular",
} as const;

export const typography = {
  display: { fontFamily: fonts.pixel, fontSize: 26, lineHeight: 36 },
  /** Título de pantalla (en la carcasa). */
  title: { fontFamily: fonts.pixel, fontSize: 15, lineHeight: 22 },
  titleLarge: { fontFamily: fonts.pixel, fontSize: 18, lineHeight: 26 },
  /** Cabecera de sección o de tarjeta. */
  sectionTitle: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 17 },
  /** Rótulo pequeño en mayúsculas ("VITRINA", "INSPÍRATE"). */
  overline: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, letterSpacing: 1 },
  /** Nombres y valores destacados en texto legible. */
  subtitle: { fontFamily: fonts.pixelBody, fontSize: 23, lineHeight: 24 },
  body: { fontFamily: fonts.pixelBody, fontSize: 20, lineHeight: 21 },
  bodyMedium: { fontFamily: fonts.pixelBody, fontSize: 20, lineHeight: 21 },
  caption: { fontFamily: fonts.pixelBody, fontSize: 17, lineHeight: 18 },
  captionSmall: { fontFamily: fonts.pixelBody, fontSize: 15, lineHeight: 16 },
  stat: { fontFamily: fonts.pixel, fontSize: 18, lineHeight: 26 },
  scientific: { fontFamily: fonts.pixelBody, fontSize: 19, fontStyle: "italic" as const },
  /** Etiquetas de botones y pestañas. */
  button: { fontFamily: fonts.pixel, fontSize: 10, lineHeight: 14 },
  pixelTitle: { fontFamily: fonts.pixel, fontSize: 14, lineHeight: 20 },
  pixelSmall: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13 },
  pixelBody: { fontFamily: fonts.pixelBody, fontSize: 20, lineHeight: 22 },
} as const;

/** "Relieve" pixel: borde inferior más grueso en lugar de sombra difusa. */
export const shadow = {
  card: { borderBottomWidth: BORDER + 2 },
  raised: { borderBottomWidth: BORDER + 3 },
} as const;

/** Alto de la barra de pestañas. */
export const TAB_BAR_HEIGHT = 70;
