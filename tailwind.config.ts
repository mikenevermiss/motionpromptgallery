import type { Config } from 'tailwindcss';
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        pop: { '0%': { opacity: '0', transform: 'translateY(6px) scale(.98)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        fadeUp: 'fadeUp .5s cubic-bezier(.2,.7,.2,1) both',
        fadeIn: 'fadeIn .2s ease-out both',
        pop: 'pop .28s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
