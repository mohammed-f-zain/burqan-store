export const theme = {
  bg: "#f4f6f8",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  line: "#e8ecf1",
  accent: "#0d9488",
  accentDark: "#0f766e",
  accentSoft: "rgba(13,148,136,0.1)",
  danger: "#e11d48",
  radius: { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 },
  shadow: {
    card: {
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 3,
    },
    float: {
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 8,
    },
  },
} as const;
