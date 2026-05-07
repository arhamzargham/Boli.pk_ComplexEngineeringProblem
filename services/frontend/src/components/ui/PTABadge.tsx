interface PTABadgeProps {
  status: 'REGISTERED_CLEAN' | 'UNREGISTERED' | 'BLACKLISTED'
}

const STYLES = {
  REGISTERED_CLEAN: { dot: 'bg-success', label: 'PTA Registered' },
  UNREGISTERED:     { dot: 'bg-warning',  label: 'Unregistered'   },
  BLACKLISTED:      { dot: 'bg-danger',   label: 'Blacklisted'    },
}

export default function PTABadge({ status }: PTABadgeProps) {
  const s = STYLES[status]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  )
}
