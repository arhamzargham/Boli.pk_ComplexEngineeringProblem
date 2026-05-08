import VettingBadge from '@/components/ui/VettingBadge'
import PTABadge from '@/components/ui/PTABadge'
import StatusBadge from '@/components/ui/StatusBadge'
import { paisaToRs, relativeTime } from '@/lib/formatters'
import type { AdminListingRow as AdminListingRowType } from '@/types'

interface Props {
  listing: AdminListingRowType
}

export default function AdminListingRow({ listing }: Props) {
  return (
    <tr>
      <td className="px-3 py-2.5 text-[12px] border-b border-border">
        <p className="text-text-primary font-medium">
          {listing.make} {listing.model}
        </p>
        <p className="text-[10px] text-text-faint mt-0.5">
          {listing.storage_gb ? `${listing.storage_gb}GB · ` : ''}Cond {listing.condition_rating}/10
        </p>
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border">
        {listing.vetting_classification ? (
          <VettingBadge
            classification={listing.vetting_classification as 'VERIFIED' | 'REVIEWED' | 'PENDING_REVIEW' | 'REJECTED'}
            score={listing.composite_score}
            size="sm"
          />
        ) : (
          <span className="text-text-faint">—</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border">
        {listing.pta_status ? (
          <PTABadge status={listing.pta_status} />
        ) : (
          <span className="text-text-faint">—</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border font-mono">
        {paisaToRs(listing.reserve_price_paisa)}
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border">
        <StatusBadge status={listing.status} size="sm" />
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border text-text-faint">
        {relativeTime(listing.created_at)}
      </td>
    </tr>
  )
}
