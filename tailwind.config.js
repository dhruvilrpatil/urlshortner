/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./backend/templates/**/*.html",
    "./js/**/*.js",
  ],
  theme: {
    extend: {
      animation: {
        'colorbends': 'colorbends 8s ease-in-out infinite',
        'flow': 'flow 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
      },
      keyframes: {
        colorbends: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.5' },
          '50%': { transform: 'translate(30px, -30px) scale(1.1)', opacity: '0.8' },
        },
        flow: {
          '0%, 100%': { transform: 'translateX(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
