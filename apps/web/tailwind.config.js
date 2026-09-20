/** @type {import('tailwindcss').Config} */
module.exports = {
  // 以 class 控制日夜；由 ThemeContext 在 <html> 上加/移除 'dark'
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 關閉 preflight，避免 Tailwind 的 base reset 覆蓋 MUI 的基礎樣式
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
