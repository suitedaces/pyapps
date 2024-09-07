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
        border: '#000',  // Using the new theme's border color
        input: 'hsl(var(--input, 210, 15%, 20%))',
        ring: 'hsl(var(--ring, 210, 15%, 30%))',
        background: '#FEF2E8',  // Using the new theme's bg color
        foreground: '#000',  // Using the new theme's text color
        primary: {
          DEFAULT: '#FFDC58',  // Using the new theme's main color
          foreground: 'hsl(var(--primary-foreground, 210, 15%, 95%))'
        },
        secondary: {
          DEFAULT: '#ffc800',  // Using the new theme's mainAccent color
          foreground: 'hsl(var(--secondary-foreground, 210, 15%, 95%))'
        },
        userMessage: {
          DEFAULT: '#5e435d',
          foreground: 'hsl(174, 80%, 95%)'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive, 0, 70%, 55%))',
          foreground: 'hsl(var(--destructive-foreground, 210, 15%, 95%))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted, 210, 15%, 40%))',
          foreground: 'hsl(var(--muted-foreground, 210, 15%, 80%))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent, 50, 100%, 50%))',
          foreground: 'hsl(var(--accent-foreground, 210, 15%, 20%))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover, 210, 15%, 20%))',
          foreground: 'hsl(var(--popover-foreground, 210, 15%, 90%))'
        },
        card: {
          DEFAULT: 'hsl(var(--card, 210, 15%, 15%))',
          foreground: 'hsl(var(--card-foreground, 210, 15%, 85%))'
        },
        // Dark mode colors
        dark: {
          bg: '#374151',
          text: '#eeefe9',
          border: '#000',
        },
        overlay: 'rgba(0,0,0,0.8)',
        secondaryBlack: '#1b1b1b',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        base: '15px'
      },
      boxShadow: {
        light: '4px 4px 0px 0px #000',
        dark: '4px 4px 0px 0px #000',
      },
      translate: {
        boxShadowX: '4px',
        boxShadowY: '4px',
        reverseBoxShadowX: '-4px',
        reverseBoxShadowY: '-4px',
      },
      fontWeight: {
        base: '500',
        heading: '700',
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
        'gradient-x': 'gradient-x 30s ease infinite'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
