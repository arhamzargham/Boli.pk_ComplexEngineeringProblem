import Link from 'next/link'
import { Smartphone } from 'lucide-react'
import VettingBadge from '@/components/ui/VettingBadge'
import PTABadge from '@/components/ui/PTABadge'
import { paisaToRs } from '@/lib/formatters'
import type { Listing } from '@/types'

interface ListingCardProps {
  listing: Listing
  featured?: boolean
}

export default function ListingCard({ listing, featured }: ListingCardProps) {
  return (
    <Link
      href={`/listings/${listing.listing_id}`}
      className={[
        'block bg-surface border rounded-lg overflow-hidden shadow-card',
        'hover:shadow-raised transition-shadow group',
        featured ? 'border-copper/40' : 'border-border',
      ].join(' ')}
    >
      {/* Image area */}
      <div className="h-[88px] bg-obs-90 flex items-center justify-center relative">
        {/* Vetting badge overlay */}
        <div className="absolute top-2.5 left-2.5">
          {listing.vetting_classification && (
            <VettingBadge
              classification={listing.vetting_classification}
              size="sm"
            />
          )}
        </div>

        {/* Featured ribbon */}
        {featured && (
          <div className="absolute top-2 right-2 bg-copper text-white text-[9px] font-medium px-2 py-0.5 rounded-full">
            Top pick
          </div>
        )}

        {/* Device illustration */}
        <Smartphone size={28} className="text-copper/40" strokeWidth={1.5} />
        <span className="absolute bottom-2 text-[9px] text-copper/50 font-mono">
          {listing.make} {listing.model}
        </span>
      </div>

      {/* Card body */}
      <div className="p-3">
        <div className="text-[13px] font-medium text-text-primary group-hover:text-copper transition-colors">
          {listing.make} {listing.model}
        </div>
        <div className="text-[11px] text-text-faint mt-0.5">
          {[
            listing.storage_gb && `${listing.storage_gb}GB`,
            listing.color_variant,
            `Cond. ${listing.condition_rating}/10`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>

        <div className="border-t border-border mt-2.5 pt-2.5 flex items-end justify-between gap-1">
          <div>
            <div className="text-[10px] text-text-faint">Reserve price</div>
            <div className="text-[15px] font-medium text-text-primary font-mono leading-tight">
              {paisaToRs(listing.reserve_price_paisa)}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {listing.pta_status && <PTABadge status={listing.pta_status} />}
            {listing.composite_score !== undefined && (
              <span className="text-[10px] text-text-faint bg-cream border border-border px-1.5 py-0.5 rounded">
                {listing.composite_score}/100
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
