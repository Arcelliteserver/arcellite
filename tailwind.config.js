/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './constants.tsx',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        display: ['"Noto Sans Display"', 'sans-serif'],
        sidebar: ['"Space Grotesk"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
