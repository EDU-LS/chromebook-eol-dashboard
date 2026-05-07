/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#e6f3ff",
          100: "#cce7ff",
          200: "#99cfff",
          300: "#66b7ff",
          400: "#339fff",
          500: "#007aff",
          600: "#0062cc",
          700: "#004999",
          800: "#003166",
          900: "#001833",
        },
      },
    },
  },
  plugins: [],
};
