/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: {
        base: '18px',
      },
      minHeight: {
        btn: '52px',
      },
    },
  },
  plugins: [],
};
