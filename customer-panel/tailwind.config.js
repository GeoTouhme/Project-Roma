 /** @type {import('tailwindcss').Config} */
 export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#B5223B",
        secondary: "#B5223B",
        black: "#111111",
        white: "#FFFFFF",
        border_color: "#DEDEDE",
        grey_text: "#777777"
      },
      fontFamily: {
        jost: ['Jost', 'sans-serif'],
      },
    },
  },
  plugins: [],
}