import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // HEA Brand Guidelines v1.0
        navy: {
          DEFAULT: "#3C549A", // Navy Blue — primary
          deep: "#2A3D7A",    // Deep Navy — secondary
        },
        aqua: {
          DEFAULT: "#C1E7F2", // Aqua Blue — primary accent
          sky: "#7BCCDF",     // Sky Aqua — secondary accent
        },
        sage: {
          DEFAULT: "#CEE2BA", // Sage Green — primary accent
          olive: "#9BB87A",   // Olive Sage — secondary accent
        },
        offwhite: "#F7F9FB",
        ink: "#1C1C1E",
      },
      fontFamily: {
        // English typeface per brand guide
        display: ["Gill Sans MT", "Gill Sans", "var(--font-prompt)", "sans-serif"],
        // Thai / bilingual typeface per brand guide
        sans: ["var(--font-prompt)", "Gill Sans MT", "sans-serif"],
      },
      borderRadius: {
        card: "1.25rem",
        pill: "999px",
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(42, 61, 122, 0.25)",
        field: "0 1px 2px rgba(42, 61, 122, 0.08)",
      },
      backgroundImage: {
        "droplet-radial":
          "radial-gradient(circle at 30% 20%, #7BCCDF 0%, #3C549A 70%)",
      },
    },
  },
  plugins: [],
};

export default config;
