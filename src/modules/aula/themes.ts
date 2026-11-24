/**
 * Catálogo puro de temas visuales personalizables por curso en Órbita Virtual.
 * Incluye 12 artes SVG de portada, 14 paletas + color personalizado (#RRGGBB con
 * degradado accesible WCAG AA), 20 emblemas SVG duotono y soporte de imagen propia.
 */

export const BANNER_PRESETS = [
  "constellation",
  "geometry",
  "botanical",
  "waves",
  "lab",
  "muisca",
  "circuits",
  "music",
  "stars",
  "mathgrid",
  "artbrush",
  "literature",
] as const;
export type BannerPreset = (typeof BANNER_PRESETS)[number];

export const BANNER_PRESET_LABELS: Record<BannerPreset, string> = {
  constellation: "Constelación Lunita",
  geometry: "Geometría moderna",
  botanical: "Naturaleza y ciencia",
  waves: "Ondas fluidas",
  lab: "Laboratorio STHEAMI",
  muisca: "Territorio Muisca",
  circuits: "Circuitos y robótica",
  music: "Pentagrama musical",
  stars: "Espacio profundo",
  mathgrid: "Plano cartesiano",
  artbrush: "Trazos artísticos",
  literature: "Letras y libros",
};

export const ACCENT_TONES = [
  "cobalt",
  "sky",
  "teal",
  "emerald",
  "green",
  "indigo",
  "purple",
  "plum",
  "pink",
  "crimson",
  "orange",
  "amber",
  "navy",
  "slate",
] as const;
export type AccentTone = (typeof ACCENT_TONES)[number];

export const ACCENT_TONE_META: Record<
  AccentTone,
  { label: string; gradient: string; swatch: string; badgeTone: "blue" | "sky" | "green" | "purple" | "orange" | "pink" }
> = {
  cobalt: {
    label: "Azul Lunita",
    gradient: "linear-gradient(125deg, #0F1747 0%, #242A82 55%, #303296 100%)",
    swatch: "#303296",
    badgeTone: "blue",
  },
  sky: {
    label: "Cielo científico",
    gradient: "linear-gradient(125deg, #0C3B5E 0%, #0369A1 60%, #0284C7 100%)",
    swatch: "#0369A1",
    badgeTone: "sky",
  },
  teal: {
    label: "Turquesa laboratorio",
    gradient: "linear-gradient(125deg, #0E3B3E 0%, #0F766E 58%, #0D9488 100%)",
    swatch: "#0F766E",
    badgeTone: "sky",
  },
  emerald: {
    label: "Esmeralda biología",
    gradient: "linear-gradient(125deg, #06392B 0%, #047857 58%, #059669 100%)",
    swatch: "#047857",
    badgeTone: "green",
  },
  green: {
    label: "Bosque ingeniería",
    gradient: "linear-gradient(125deg, #143D12 0%, #225E0A 55%, #2F7D00 100%)",
    swatch: "#2F7D00",
    badgeTone: "green",
  },
  indigo: {
    label: "Índigo astronomía",
    gradient: "linear-gradient(125deg, #1E1B4B 0%, #3730A3 58%, #4F46E5 100%)",
    swatch: "#4338CA",
    badgeTone: "blue",
  },
  purple: {
    label: "Órbita tecnología",
    gradient: "linear-gradient(125deg, #2E1065 0%, #5B21B6 58%, #6D28D9 100%)",
    swatch: "#6D28D9",
    badgeTone: "purple",
  },
  plum: {
    label: "Ciruela filosofía",
    gradient: "linear-gradient(125deg, #3B0764 0%, #701A75 58%, #86198F 100%)",
    swatch: "#7E22CE",
    badgeTone: "purple",
  },
  pink: {
    label: "Magenta artes",
    gradient: "linear-gradient(125deg, #6B113B 0%, #9D174D 58%, #BE185D 100%)",
    swatch: "#BE185D",
    badgeTone: "pink",
  },
  crimson: {
    label: "Carmesí historia",
    gradient: "linear-gradient(125deg, #5A0B1A 0%, #9F1239 58%, #BE123C 100%)",
    swatch: "#9F1239",
    badgeTone: "pink",
  },
  orange: {
    label: "Terracota humanidades",
    gradient: "linear-gradient(125deg, #6C2E09 0%, #9A3412 58%, #B45309 100%)",
    swatch: "#B45309",
    badgeTone: "orange",
  },
  amber: {
    label: "Ámbar literatura",
    gradient: "linear-gradient(125deg, #4F2A06 0%, #854D0E 58%, #A16207 100%)",
    swatch: "#A16207",
    badgeTone: "orange",
  },
  navy: {
    label: "Noche editorial",
    gradient: "linear-gradient(125deg, #070C2E 0%, #0F1747 65%, #1E293B 100%)",
    swatch: "#0F1747",
    badgeTone: "blue",
  },
  slate: {
    label: "Grafito minimal",
    gradient: "linear-gradient(125deg, #0F172A 0%, #1E293B 58%, #334155 100%)",
    swatch: "#334155",
    badgeTone: "blue",
  },
};

export const COURSE_ICONS = [
  "book",
  "calculator",
  "flask",
  "microscope",
  "dna",
  "atom",
  "cpu",
  "code",
  "rocket",
  "planet",
  "palette",
  "music",
  "feather",
  "scroll",
  "globe",
  "compass",
  "leaf",
  "heart",
  "chart",
  "trophy",
] as const;
export type CourseIconKey = (typeof COURSE_ICONS)[number];

export const COURSE_ICON_LABELS: Record<CourseIconKey, string> = {
  book: "Lectura",
  calculator: "Matemáticas",
  flask: "Química",
  microscope: "Laboratorio",
  dna: "Biología",
  atom: "Física",
  cpu: "Robótica",
  code: "Programación",
  rocket: "Innovación",
  planet: "Astronomía",
  palette: "Artes",
  music: "Música",
  feather: "Escritura",
  scroll: "Historia",
  globe: "Idiomas",
  compass: "Geografía",
  leaf: "Ecología",
  heart: "Ética",
  chart: "Economía",
  trophy: "Deportes",
};

export const COURSE_LAYOUTS = ["cards", "compact"] as const;
export type CourseLayoutStyle = (typeof COURSE_LAYOUTS)[number];

export interface CourseThemeConfig {
  bannerPreset: BannerPreset;
  accentTone: AccentTone;
  customColorHex: string | null;
  hasBannerImage: boolean;
  iconKey: CourseIconKey;
  layoutStyle: CourseLayoutStyle;
  welcomeMessage: string;
}

export const DEFAULT_COURSE_THEME: CourseThemeConfig = {
  bannerPreset: "constellation",
  accentTone: "cobalt",
  customColorHex: null,
  hasBannerImage: false,
  iconKey: "book",
  layoutStyle: "cards",
  welcomeMessage: "",
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Valida un color hexadecimal `#RRGGBB` y devuelve formato limpio en mayúsculas o `null`. */
export function normalizeCustomHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clampByte(v).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/**
 * Construye un degradado profundo a partir de un color `#RRGGBB` elegido por el docente,
 * acotando la luminancia máxima para garantizar contraste WCAG AA con texto blanco.
 */
export function buildCustomColorGradient(hex: string): string {
  const clean = normalizeCustomHex(hex);
  if (!clean) return ACCENT_TONE_META.cobalt.gradient;

  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);

  // Luminancia relativa aproximada (0..1); si el color es muy claro, se oscurece para mantener legibilidad blanca.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const safeScale = luma > 0.42 ? 0.42 / luma : 1;

  const midR = r * safeScale;
  const midG = g * safeScale;
  const midB = b * safeScale;

  const dark = toHex(midR * 0.46, midG * 0.46, midB * 0.52);
  const mid = toHex(midR * 0.82, midG * 0.82, midB * 0.86);
  const end = toHex(midR, midG, midB);

  return `linear-gradient(125deg, ${dark} 0%, ${mid} 56%, ${end} 100%)`;
}

export function resolveBannerGradient(theme: Pick<CourseThemeConfig, "accentTone" | "customColorHex">): string {
  if (theme.customColorHex) {
    return buildCustomColorGradient(theme.customColorHex);
  }
  return ACCENT_TONE_META[theme.accentTone].gradient;
}

export function normalizeCourseTheme(
  raw?: Partial<{
    bannerPreset: string | null;
    accentTone: string | null;
    customColorHex: string | null;
    bannerImageKey: string | null;
    hasBannerImage: boolean;
    iconKey: string | null;
    layoutStyle: string | null;
    welcomeMessage: string | null;
  }> | null,
): CourseThemeConfig {
  if (!raw) return DEFAULT_COURSE_THEME;
  return {
    bannerPreset: (BANNER_PRESETS as readonly string[]).includes(raw.bannerPreset ?? "")
      ? (raw.bannerPreset as BannerPreset)
      : DEFAULT_COURSE_THEME.bannerPreset,
    accentTone: (ACCENT_TONES as readonly string[]).includes(raw.accentTone ?? "")
      ? (raw.accentTone as AccentTone)
      : DEFAULT_COURSE_THEME.accentTone,
    customColorHex: normalizeCustomHex(raw.customColorHex),
    hasBannerImage: Boolean(raw.hasBannerImage ?? raw.bannerImageKey),
    iconKey: (COURSE_ICONS as readonly string[]).includes(raw.iconKey ?? "")
      ? (raw.iconKey as CourseIconKey)
      : DEFAULT_COURSE_THEME.iconKey,
    layoutStyle: (COURSE_LAYOUTS as readonly string[]).includes(raw.layoutStyle ?? "")
      ? (raw.layoutStyle as CourseLayoutStyle)
      : DEFAULT_COURSE_THEME.layoutStyle,
    welcomeMessage: raw.welcomeMessage ?? "",
  };
}
