export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                ink:    { 900: '#08080F', 800: '#0F0F1C', 700: '#171728', 600: '#1F1F35' },
                violet: { DEFAULT: '#7C3AED', soft: '#A78BFA' },
                pink:   { DEFAULT: '#EC4899', soft: '#F9A8D4' },
                cyan:   { DEFAULT: '#06B6D4', soft: '#67E8F9' },
                lime:   { DEFAULT: '#84CC16', soft: '#BEF264' },
            },
            fontFamily: { display: ['"Space Grotesk"', 'system-ui', 'sans-serif'] },
            boxShadow: {
                glow: '0 0 40px -10px rgba(124,58,237,.6)',
                pink: '0 0 40px -10px rgba(236,72,153,.6)',
            },
            animation: {
                gradient: 'gradient 8s ease infinite',
                pop: 'pop .18s ease-out',
            },
            keyframes: {
                gradient: {
                    '0%,100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                pop: {
                    '0%': { transform: 'scale(.8)', opacity: 0 },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                },
            },
        },
    },
    plugins: [],
};