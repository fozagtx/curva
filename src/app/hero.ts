import { heroui } from "@heroui/react";

export default heroui({
  defaultTheme: "dark",
  themes: {
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
