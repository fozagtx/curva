import { heroui } from "@heroui/react";

// Light / white sportsbook default (TikTok × SportyBet UX profile).
export default heroui({
  defaultTheme: "light",
  themes: {
    light: {
      colors: {
        background: "#FFFFFF",
        foreground: "#09090B",
        content1: "#FFFFFF",
        content2: "#F4F4F5",
        content3: "#E4E4E7",
        content4: "#D4D4D8",
        divider: "#E4E4E7",
        primary: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
          800: "#166534",
          900: "#14532D",
          DEFAULT: "#16A34A",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#0284C7",
          foreground: "#FFFFFF",
        },
        focus: "#16A34A",
        default: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
          DEFAULT: "#71717A",
          foreground: "#09090B",
        },
      },
    },
    dark: {
      colors: {
        background: "#09090B",
        content1: "#111113",
        content2: "#18181B",
        primary: {
          50: "#052814",
          100: "#0A3D20",
          200: "#0F5A2F",
          300: "#12783E",
          400: "#16A34A",
          500: "#22C55E",
          600: "#4ADE80",
          700: "#86EFAC",
          800: "#BBF7D0",
          900: "#DCFCE7",
          DEFAULT: "#22C55E",
          foreground: "#03170B",
        },
        secondary: {
          DEFAULT: "#38BDF8",
          foreground: "#03171F",
        },
        focus: "#22C55E",
      },
    },
  },
});
