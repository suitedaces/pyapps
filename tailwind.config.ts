/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
    	extend: {
    		colors: {
    			main: '#FFDC58',
    			mainAccent: '#ffc800',
    			overlay: 'rgba(0,0,0,0.8)',
    			blue: '#AF79FF',
    			matte: '#212121',
    			bg: '#E5E6E9',
    			text: '#000',
                white: '#FFFFFF',
    			border: '#000',
    			darkBg: '#374151',
    			darkText: '#eeefe9',
    			darkBorder: '#000',
    			secondaryBlack: '#1b1b1b',
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		borderRadius: {
    			base: '15px'
    		},
    		boxShadow: {
    			light: '4px 4px 0px 0px #000',
    			dark: '4px 4px 0px 0px #000'
    		},
    		translate: {
    			boxShadowX: '4px',
    			boxShadowY: '4px',
    			reverseBoxShadowX: '-4px',
    			reverseBoxShadowY: '-4px'
    		},
    		fontWeight: {
    			base: '500',
    			heading: '700'
    		},
    	}
    },
    plugins: [require('tailwindcss-animate')],
}
