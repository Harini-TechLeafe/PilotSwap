/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#F4F8FF',     // page background (soft white-blue)
        panel: '#FFFFFF',     // cards
        cloud: '#0B1F4D',     // main text (deep navy, matches logo)
        horizon: '#1550E8',   // primary blue (buttons, links)
        altitude: '#0095FF',  // bright sky-blue accent
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
