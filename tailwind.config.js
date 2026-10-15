/** @type {import('tailwindcss').Config} */
// Colours that change between light and dark are CSS variables (see src/index.css),
// so every existing class like `bg-blue-50` or `text-slate-500` follows the theme automatically.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: v('night'),       // page background
        panel: v('panel'),       // cards, menus, modals
        cloud: v('cloud'),       // main text
        horizon: v('horizon'),   // primary blue (buttons, links)
        altitude: v('altitude'), // bright sky-blue accent
        blue: { 50: v('blue-50'), 100: v('blue-100'), 200: v('blue-200') },
        slate: {
          50: v('slate-50'), 100: v('slate-100'), 200: v('slate-200'), 300: v('slate-300'), 400: v('slate-400'),
          500: v('slate-500'), 600: v('slate-600'), 700: v('slate-700'), 800: v('slate-800'), 900: v('slate-900'),
        },
        emerald: { 50: v('emerald-50'), 600: v('emerald-600'), 700: v('emerald-700') },
        rose: { 50: v('rose-50'), 600: v('rose-600'), 700: v('rose-700') },
        amber: { 50: v('amber-50'), 100: v('amber-100'), 600: v('amber-600'), 800: v('amber-800') },
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
