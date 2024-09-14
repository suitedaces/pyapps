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
                mainAccent: '#ffc800', // not needed for shadcn components
                overlay: 'rgba(0,0,0,0.8)', // background color overlay for alert dialogs, modals, etc.
                blue: '#AF79FF',
                matte: '#212121',

                // light mode
                bg: '#F0EFE9',
                text: '#000',
                border: '#000',

                // dark mode
                darkBg: '#374151',
                darkText: '#eeefe9',
                darkBorder: '#000',
                secondaryBlack: '#1b1b1b', // opposite of plain white, not used pitch black because borders and box-shadows are that color
            },
            borderRadius: {
                base: '15px',
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
        },
    },
    plugins: [require('tailwindcss-animate')],
}
