interface KYCBadgeProps {
  tier: 'BASIC' | 'FULL'
}

export default function KYCBadge({ tier }: KYCBadgeProps) {
  return tier === 'FULL' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-copper bg-copper/10 border border-copper/20 px-2 py-0.5 rounded">
      FULL
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
      BASIC
    </span>
  )
}
