/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './entrypoints/**/*.{html,ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  plugins: [],
}
