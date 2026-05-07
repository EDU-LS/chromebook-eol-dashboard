/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef2ff",
          500: "#4f46e5",
          600: "#4338ca",
          700: "#3730a3",
          900: "#1e1b4b",
        },
      },
    },
  },
  plugins: [],
};
