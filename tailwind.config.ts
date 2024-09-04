/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border, 210, 15%, 25%))",
        input: "hsl(var(--input, 210, 15%, 20%))",
        ring: "hsl(var(--ring, 210, 15%, 30%))",
        background: "hsl(var(--background, 210, 15%, 10%))",
        foreground: "hsl(var(--foreground, 210, 15%, 90%))",
        primary: {
          DEFAULT: "hsl(var(--primary, 220, 90%, 56%))",  // Blue for primary buttons or elements
          foreground: "hsl(var(--primary-foreground, 210, 15%, 95%))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 330, 100%, 60%))",  // Pink for secondary accents
          foreground: "hsl(var(--secondary-foreground, 210, 15%, 95%))",
        },
        userMessage: {
          DEFAULT: "#5e435d", 
          foreground: "hsl(174, 80%, 95%)",
        },
        gradientStart: "#4F46E5", // Indigo
        gradientMid: "#3B82F6", // Blue
        gradientEnd: "#6366F1", // Lighter Indigo
        destructive: {
          DEFAULT: "hsl(var(--destructive, 0, 70%, 55%))",  // Red for warnings or destructive actions
          foreground: "hsl(var(--destructive-foreground, 210, 15%, 95%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 210, 15%, 40%))",  // Muted gray for subtle elements
          foreground: "hsl(var(--muted-foreground, 210, 15%, 80%))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 50, 100%, 50%))",  // Yellow for highlights or alerts
          foreground: "hsl(var(--accent-foreground, 210, 15%, 20%))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover, 210, 15%, 20%))",  // Dark gray for popovers
          foreground: "hsl(var(--popover-foreground, 210, 15%, 90%))",
        },
        card: {
          DEFAULT: "hsl(var(--card, 210, 15%, 15%))",  // Slightly lighter gray for cards
          foreground: "hsl(var(--card-foreground, 210, 15%, 85%))",
        },
      },
      borderRadius: {
        lg: "var(--radius, 12px)",
        md: "calc(var(--radius, 12px) - 2px)",
        sm: "calc(var(--radius, 12px) - 4px)",
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        }
      },
      animation: {
        'gradient-x': 'gradient-x 30s ease infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
