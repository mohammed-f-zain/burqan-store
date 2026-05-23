/** Burqan logo palette — cyan highlight, royal blue, navy (see assets/burqanlogo.png). */
export const brand = {
  cyan: "#22d3ee",
  blue: "#2563eb",
  navy: "#1e3a8a",
  navyDark: "#0a1628",
  black: "#000000",
} as const;

export const theme = {
  bg: "#eef4fc",
  bgSplash: "#ffffff",
  card: "#ffffff",
  text: brand.navyDark,
  muted: "#64748b",
  line: "#dbeafe",
  accent: brand.blue,
  accent2: brand.cyan,
  accentDark: brand.navy,
  accentSoft: "rgba(37, 99, 235, 0.12)",
  accentSoftCyan: "rgba(34, 211, 238, 0.15)",
  onAccent: "#ffffff",
  danger: "#e11d48",
  radius: { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 },
  shadow: {
    card: {
      shadowColor: brand.navyDark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    float: {
      shadowColor: brand.navyDark,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
  },
} as const;
