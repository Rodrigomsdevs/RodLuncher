import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        grass: '#18A800',
        moss: '#60D818',
        dirt: '#F0A800',
        gold: '#F0A800',
        glow: '#F0D818',
        pine: '#003000',
        stone: '#B8B16A',
        ember: '#FF4D2E',
        night: '#020500',
      },
    },
  },
} satisfies Config;
