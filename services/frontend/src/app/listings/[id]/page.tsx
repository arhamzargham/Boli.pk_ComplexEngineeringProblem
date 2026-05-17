import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Smartphone, ShieldCheck } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import VettingBadge from '@/components/ui/VettingBadge'
import PTABadge from '@/components/ui/PTABadge'
import VettingReport from '@/components/listing/VettingReport'
import { api } from '@/lib/api'
import { paisaToRs, conditionLabel, truncateImei } from '@/lib/formatters'

function listingToAuctionId(listingId: string): string {
  // Phase 2 auction IDs use e1 prefix to avoid conflicts with Phase 1 seed auctions
  return 'e1' + listingId.slice(2)
}

interface Props {
  params: { id: string }
}

export default async function ListingDetailPage({ params }: Props) {
  let listing
  try {
    listing = await api.listings.get(params.id)
  } catch {
    notFound()
  }
  if (!listing) notFound()

  const shortId = listing.listing_id.slice(-4).toUpperCase()

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-2.5 flex items-center justify-between">
          <nav className="text-[11px]" aria-label="Breadcrumb">
            <Link href="/" className="text-copper hover:underline">Home</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <Link href="/" className="text-copper hover:underline">Marketplace</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <span className="text-text-muted">{listing.make} {listing.model}</span>
          </nav>
          <span className="text-[11px] text-text-faint">Listing #L-{shortId}</span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 bg-cream">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-4">
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-4">

            {/* LEFT COLUMN */}
            <div className="space-y-3">
              {/* Main image */}
              <div className="h-[220px] bg-obs-90 rounded-xl relative flex items-center justify-center overflow-hidden">
                <div className="absolute top-3 left-3">
                  {listing.vetting_classification && (
                    <VettingBadge
                      classification={listing.vetting_classification}
                      score={listing.composite_score}
                    />
                  )}
                </div>
                {listing.images && listing.images.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.images[0].storage_url}
                    alt={`${listing.make} ${listing.model}`}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className="flex flex-col items-center gap-1 text-copper/40">
                  <Smartphone size={40} strokeWidth={1.2} />
                  <span className="text-[11px] font-medium text-copper/50">
                    {listing.make} {listing.model}
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-2">
                {['Front', 'Back', 'Side', 'Screen', 'Box'].map((label, i) => (
                  <div
                    key={label}
                    className={`flex-1 h-11 bg-obs-90 rounded flex items-center justify-center border ${
                      i === 0 ? 'border-copper' : 'border-transparent'
                    }`}
                  >
                    <span className="text-[8px] text-copper/50">{label}</span>
                  </div>
                ))}
              </div>

              {/* Vetting report */}
              <VettingReport
                classification={listing.vetting_classification}
                compositeScore={listing.composite_score}
                ptaStatus={listing.pta_status}
              />
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-3">
              {/* Auction panel */}
              <div className="bg-surface border border-border rounded-xl p-3.5">
                <p className="text-[9px] text-text-faint uppercase tracking-widest mb-2">Live Auction</p>
                <p className="font-serif text-[22px] text-text-primary leading-tight">
                  {paisaToRs(listing.reserve_price_paisa)}
                </p>
                <p className="text-[11px] text-text-faint mt-0.5">
                  Reserve price · You will pay {paisaToRs(Math.floor(listing.reserve_price_paisa * 1.02))} incl. 2% fee
                </p>

                <div className="bg-cream rounded-lg p-2.5 mt-3 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] text-text-faint">Auction ends in</p>
                    <p className="text-[16px] font-medium font-mono">02 : 14 : 38</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-text-faint">Bids placed</p>
                    <p className="text-[16px] font-medium">14</p>
                  </div>
                </div>

                <p className="text-[10px] text-text-faint mt-2.5">
                  Reserve: {paisaToRs(listing.reserve_price_paisa)} · Platform fee: 2% buyer + 2% seller · WHT: 1% · ICT: 15% of fees
                </p>

                <Link
                  href={`/listings/${listing.listing_id}/auction?auctionId=${listingToAuctionId(listing.listing_id)}`}
                  className="block w-full bg-copper text-white text-center py-2.5 rounded-[9px] text-[13px] font-medium mt-2.5 hover:bg-copper/90 transition-colors"
                >
                  Join Auction · Place a Bid
                </Link>
                <p className="text-[10px] text-text-faint text-center mt-1.5">
                  Funds reserved from wallet · Released if outbid
                </p>
              </div>

              {/* Specs */}
              <div className="bg-surface border border-border rounded-xl p-3.5">
                <h2 className="text-[12px] font-medium text-text-primary mb-3">Device specifications</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Make',      value: listing.make },
                    { label: 'Model',     value: listing.model },
                    { label: 'Storage',   value: listing.storage_gb ? `${listing.storage_gb} GB` : '—' },
                    { label: 'Colour',    value: listing.color_variant ?? '—' },
                    { label: 'Condition', value: `${listing.condition_rating}/10 · ${conditionLabel(listing.condition_rating)}` },
                    { label: 'IMEI',      value: truncateImei(listing.imei) },
                  ].map(spec => (
                    <div key={spec.label} className="bg-cream rounded-lg p-2">
                      <p className="text-[10px] text-text-faint">{spec.label}</p>
                      <p className={`text-[12px] font-medium mt-0.5 ${spec.label === 'IMEI' ? 'font-mono text-copper' : ''}`}>
                        {spec.value}
                      </p>
                    </div>
                  ))}
                </div>
                {listing.pta_status && (
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
                    <PTABadge status={listing.pta_status} />
                    <span className="text-[10px] text-text-faint">Verified at listing</span>
                  </div>
                )}
              </div>

              {/* Seller card */}
              <div className="bg-surface border border-border rounded-xl p-3.5">
                <p className="text-[11px] font-medium text-text-primary mb-2.5">Seller</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-obs-90 flex items-center justify-center text-copper text-[12px] font-medium flex-shrink-0">
                    MK
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-text-primary">Mohammad K.</p>
                    <p className="text-[10px] text-text-faint">Member since Jan 2026 · 12 transactions</p>
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-1 rounded-sm ${i < 4 ? 'bg-success' : 'bg-border'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[15px] font-medium text-text-primary">88</p>
                    <p className="text-[9px] text-text-faint">Trust score</p>
                  </div>
                </div>
              </div>

              {/* Escrow notice */}
              <div className="bg-copper-light border border-copper-border rounded-lg p-3 flex gap-2.5">
                <ShieldCheck size={14} className="text-copper mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-obs leading-relaxed">
                  Funds held in escrow until IMEI verification and cryptographic QR settlement at meetup.
                  Zero fraud risk guaranteed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}
