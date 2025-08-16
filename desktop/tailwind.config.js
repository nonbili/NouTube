/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['../components/**/*.{js,jsx,ts,tsx}', 'src/renderer/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
}
