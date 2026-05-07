// Stroop compliance enforced: text and background ALWAYS same colour family.
// VERIFIED = green text on green bg. REVIEWED = amber on amber. No exceptions.

interface VettingBadgeProps {
  classification: 'VERIFIED' | 'REVIEWED' | 'PENDING_REVIEW' | 'REJECTED'
  score?: number
  size?: 'sm' | 'md'
}

const STYLES = {
  VERIFIED:       { dot: 'bg-verified-text',  bg: 'bg-verified-bg',  text: 'text-verified-text', label: 'VERIFIED'  },
  REVIEWED:       { dot: 'bg-reviewed-text',  bg: 'bg-reviewed-bg',  text: 'text-reviewed-text', label: 'REVIEWED'  },
  PENDING_REVIEW: { dot: 'bg-gray-400',        bg: 'bg-gray-100',     text: 'text-gray-500',      label: 'PENDING'   },
  REJECTED:       { dot: 'bg-red-600',         bg: 'bg-red-100',      text: 'text-red-700',       label: 'REJECTED'  },
}

export default function VettingBadge({ classification, score, size = 'md' }: VettingBadgeProps) {
  const s = STYLES[classification]
  const textSize = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'
  const dotSize  = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${textSize} ${s.bg} ${s.text}`}>
      <span className={`${dotSize} rounded-full flex-shrink-0 ${s.dot}`} />
      {score !== undefined ? `${s.label} · ${score}/100` : s.label}
    </span>
  )
}
