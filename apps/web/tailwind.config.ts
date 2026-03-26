import type { Config } from 'tailwindcss';

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#FAF7F0",
          100: "#F3EEE4",
          200: "#E6DED1",
          300: "#D7CBB6"
        },
        forest: {
          700: "#2F3A2B",
          800: "#1F2A1C"
        },
        sage: {
          500: "#6F7C67",
          600: "#5A6A52"
        }
      },
      boxShadow: {
        soft: "0 20px 60px rgba(0,0,0,0.08)"
      }
    }
  },
  plugins: []
};

export default config;
