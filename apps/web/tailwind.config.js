/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Monochromatic background scale
        background: {
          primary: '#0a0a0b',
          secondary: '#111113',
          tertiary: '#18181b',
          hover: '#1f1f23',
          active: '#27272b',
        },
        
        // Text scale
        content: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          tertiary: '#71717a',
          quaternary: '#52525b',
        },
        
        // Borders
        stroke: {
          primary: '#27272a',
          secondary: '#3f3f46',
        },
        
        // School accent (CSS variable driven for theming)
        accent: {
          DEFAULT: 'var(--school-primary)',
          hover: 'var(--school-primary-hover)',
        },
        
        // Cornell fallback
        cornell: {
          red: '#B31B1B',
          'red-hover': '#dc2626',
        },
      },
      
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['13px', { lineHeight: '20px' }],
        'base': ['14px', { lineHeight: '22px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['18px', { lineHeight: '26px' }],
        '2xl': ['22px', { lineHeight: '28px', letterSpacing: '-0.02em' }],
        '3xl': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
        '4xl': ['36px', { lineHeight: '42px', letterSpacing: '-0.02em' }],
      },
      
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '10px',
        '2xl': '12px',
      },
      
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
        'md': '0 2px 8px rgba(0, 0, 0, 0.4)',
        'lg': '0 4px 16px rgba(0, 0, 0, 0.5)',
      },
      
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.25s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.25s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
        'shimmer': 'shimmer 1.5s infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      
      transitionDuration: {
        '150': '150ms',
      },
    },
  },
  plugins: [],
}