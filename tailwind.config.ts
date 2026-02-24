import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/client/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b1020',
          900: '#0f172a',
          800: '#131b2e'
        },
        indigoGlow: '#4F46E5',
        electric: '#06B6D4'
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      borderRadius: {
        button: '8px',
        card: '12px',
        modal: '16px'
      },
      boxShadow: {
        glass: '0 8px 30px rgba(15, 23, 42, 0.45), 0 2px 8px rgba(15, 23, 42, 0.35)',
        lift: '0 18px 45px rgba(8, 13, 28, 0.55), 0 6px 12px rgba(8, 13, 28, 0.35)'
      },
      backgroundImage: {
        aurora: 'radial-gradient(circle at 10% 20%, rgba(6, 182, 212, 0.35), transparent 45%), radial-gradient(circle at 90% 10%, rgba(79, 70, 229, 0.35), transparent 45%), radial-gradient(circle at 50% 90%, rgba(99, 102, 241, 0.25), transparent 50%)'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(6, 182, 212, 0.0)' },
          '50%': { boxShadow: '0 0 22px rgba(6, 182, 212, 0.5)' }
        }
      },
      animation: {
        shimmer: 'shimmer 2.2s linear infinite',
        float: 'float 6s ease-in-out infinite',
        glow: 'pulseGlow 2.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config;
