import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      paper: 'var(--paper)',
      ink: 'var(--ink)',
      accent: 'var(--accent)',
      muted: 'var(--muted)',
      rule: 'var(--rule)',
      elev: 'var(--elev)',
      win: 'var(--win)',
      error: 'var(--error)',
    },
    extend: {},
  },
  plugins: [],
} satisfies Config;
