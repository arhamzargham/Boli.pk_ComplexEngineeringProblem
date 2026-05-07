import { Loader2 } from 'lucide-react'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

const VARIANT_CLASSES = {
  primary:     'bg-copper hover:bg-copper/90 active:bg-copper/80 text-white',
  secondary:   'bg-cream border border-border hover:bg-border text-text-primary',
  destructive: 'bg-danger hover:bg-danger/90 active:bg-danger/80 text-white',
  ghost:       'bg-transparent hover:bg-copper/10 text-copper',
}

const SIZE_CLASSES = {
  sm: 'h-8  px-3 text-xs  rounded-md',
  md: 'h-11 px-4 text-sm  rounded-[9px]',
  lg: 'h-12 px-6 text-sm  rounded-[9px]',
}

export default function Button({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled = false,
  fullWidth = false,
  children,
  onClick,
  type = 'button',
  className = '',
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-colors select-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          <span className="sr-only">Loading…</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
