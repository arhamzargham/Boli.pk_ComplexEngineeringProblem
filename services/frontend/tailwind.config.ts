import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        obs:              'var(--obs)',
        'obs-90':         'var(--obs-90)',
        'obs-80':         'var(--obs-80)',
        copper:           'var(--copper)',
        'copper-light':   'var(--copper-light)',
        'copper-border':  'var(--copper-border)',
        cream:            'var(--cream)',
        surface:          'var(--surface)',
        'text-primary':   'var(--text-primary)',
        'text-muted':     'var(--text-muted)',
        'text-faint':     'var(--text-faint)',
        border:           'var(--border)',
        'verified-bg':    'var(--verified-bg)',
        'verified-text':  'var(--verified-text)',
        'reviewed-bg':    'var(--reviewed-bg)',
        'reviewed-text':  'var(--reviewed-text)',
        success:          'var(--success)',
        warning:          'var(--warning)',
        danger:           'var(--danger)',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans:  ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '9px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        raised:  '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        overlay: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}

export default config
