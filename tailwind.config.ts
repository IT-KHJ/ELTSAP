import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#e83828",
          hover: "#c32f22",
          light: "#fdefee",
        },
        "ne-black": "#1d1717",
        "ne-blue": "#a0d2f2",
        "ne-gold": "#debe95",
        "ne-silver": "#cdcecd",
      },
      fontFamily: {
        sans: ["Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"],
        "kor-title": ["KOROAD", "Pretendard", "sans-serif"],
        "kor-sub": ["Paperlogy", "Pretendard", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
