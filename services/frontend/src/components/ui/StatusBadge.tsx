interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

function toTitleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case 'ACTIVE':
    case 'SETTLED':
    case 'REGISTERED_CLEAN':
    case 'VERIFIED':
    case 'FULL':
      return { bg: 'bg-verified-bg', text: 'text-verified-text' }

    case 'REVIEWED':
    case 'PENDING_REVIEW':
    case 'PENDING_MEETUP':
    case 'MEETUP_CONFIRMED':
    case 'BASIC':
    case 'SCHEDULED':
      return { bg: 'bg-reviewed-bg', text: 'text-reviewed-text' }

    case 'REJECTED':
    case 'BLACKLISTED':
    case 'DISPUTED':
    case 'CANCELLED':
    case 'CANCELLED_BY_SELLER':
    case 'CANCELLED_BY_ADMIN':
      return { bg: 'bg-red-100', text: 'text-red-700' }

    case 'SOLD':
    case 'CLOSED_WITH_BIDS':
    case 'QR_SCANNED':
      return { bg: 'bg-obs/10', text: 'text-obs' }

    case 'UNREGISTERED':
    case 'UNSOLD_EXPIRED':
    case 'REFUNDED':
    case 'CLOSED_NO_BIDS':
      return { bg: 'bg-gray-100', text: 'text-gray-500' }

    default:
      return { bg: 'bg-gray-100', text: 'text-gray-400' }
  }
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { bg, text } = getStyle(status)
  const cls = size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${cls} ${bg} ${text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 flex-shrink-0" />
      {toTitleCase(status)}
    </span>
  )
}
