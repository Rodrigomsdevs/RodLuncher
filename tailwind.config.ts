import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        grass: '#5A9E4B',
        moss: '#8DD36B',
        dirt: '#8B5A2B',
        stone: '#707070',
        ember: '#E94560',
        night: '#0D1117',
      },
    },
  },
} satisfies Config;
