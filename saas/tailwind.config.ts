import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08111f",
        panel: "#101c2f",
        mint: "#4ade80",
        cyan: "#22d3ee"
      }
    }
  },
  plugins: []
} satisfies Config;
