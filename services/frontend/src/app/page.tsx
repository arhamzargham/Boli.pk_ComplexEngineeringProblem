import { Star, ShieldCheck, Lock, Cpu } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import ListingCard from '@/components/listing/ListingCard'
import { api } from '@/lib/api'
import type { Listing } from '@/types'

const TRUST_ITEMS = [
  { icon: Star,        title: '2,847 transactions safely settled', sub: 'Since platform launch' },
  { icon: ShieldCheck, title: 'Rs. 0 fraud losses',                sub: 'Escrow-protected funds' },
  { icon: Lock,        title: 'Funds locked in escrow',            sub: 'Released at QR scan only' },
  { icon: Cpu,         title: 'AI vetting on all listings',        sub: '6-point pipeline, <5s avg' },
]

const FILTER_CHIPS = ['All devices', 'iPhone', 'Samsung', 'OnePlus', 'Pixel', 'PTA Only']

async function getListings(): Promise<{ listings: Listing[]; note: string }> {
  try {
    const active = await api.listings.list({ status: 'ACTIVE', limit: 6 })
    if (active.data.length > 0) return { listings: active.data, note: '' }

    const sold = await api.listings.list({ status: 'SOLD', limit: 6 })
    return {
      listings: sold.data,
      note: sold.data.length > 0 ? 'Showing recently sold listings — seed an ACTIVE listing to populate the feed.' : '',
    }
  } catch {
    return { listings: [], note: '' }
  }
}

export default async function HomePage() {
  const { listings, note } = await getListings()

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* HERO */}
      <section className="bg-obs">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8 md:py-10">
          <p className="text-[10px] font-medium tracking-widest uppercase text-copper mb-2">
            AI-VERIFIED · ESCROW PROTECTED · CRYPTOGRAPHIC SETTLEMENT
          </p>
          <h1 className="font-serif text-[28px] md:text-[36px] text-white leading-tight max-w-[600px]">
            Pakistan&apos;s only guaranteed C2C device marketplace.
          </h1>
          <p className="text-[14px] text-white/55 mt-2 max-w-[480px]">
            Every listing verified. Every rupee protected. Every meetup safe.
          </p>
          <p className="text-[12px] text-white/30 italic mt-1">Boli tumhari. Guarantee hamari.</p>

          {/* Search */}
          <div className="flex gap-2 mt-5 max-w-[520px]">
            <input
              type="text"
              placeholder="Search iPhone, Samsung, Pixel, OnePlus…"
              className="flex-1 bg-white/8 border border-copper/25 rounded-[9px] px-3.5 py-2.5 text-[13px] text-white placeholder-white/35 focus:outline-none focus:border-copper/60"
            />
            <button className="bg-copper text-white text-[13px] px-5 rounded-[9px] hover:bg-copper/90 transition-colors flex-shrink-0">
              Search
            </button>
          </div>

          {/* Quick filter chips */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {['iPhone 14 series', 'Samsung S23', 'Under Rs. 100k', 'PTA Registered', 'Condition 8+'].map(chip => (
              <button
                key={chip}
                className="bg-white/8 border border-white/12 rounded-full px-2.5 py-1 text-[10px] text-white/60 hover:text-white/90 hover:border-white/25 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Trust bar */}
        <div className="border-t border-copper/15 bg-white/[0.03]">
          <div className="max-w-[1280px] mx-auto px-6 md:px-10">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-copper/10">
              {TRUST_ITEMS.map(item => (
                <div key={item.title} className="flex items-center gap-2.5 py-3 px-4 first:pl-0">
                  <item.icon size={16} className="text-copper/70 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-medium text-white/80">{item.title}</p>
                    <p className="text-[10px] text-white/35 mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FILTER ROW */}
      <div className="bg-surface border-b border-border sticky top-[52px] z-40">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-2.5 flex items-center gap-2 overflow-x-auto">
          {FILTER_CHIPS.map((chip, i) => (
            <button
              key={chip}
              className={`flex-shrink-0 text-[11px] px-3 py-1 rounded-full border transition-colors ${
                i === 0
                  ? 'bg-obs text-white border-obs'
                  : 'border-border text-text-muted hover:border-text-faint'
              }`}
            >
              {chip}
            </button>
          ))}
          <select className="ml-auto text-[11px] text-text-muted bg-transparent border-none focus:outline-none flex-shrink-0 cursor-pointer">
            <option>Newest first</option>
            <option>Price: low to high</option>
            <option>Price: high to low</option>
          </select>
        </div>
      </div>

      {/* BREADCRUMB */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-2 flex items-center justify-between">
          <nav className="text-[11px]" aria-label="Breadcrumb">
            <span className="text-copper">Home</span>
            <span className="text-text-faint mx-1.5">›</span>
            <span className="text-text-muted">Marketplace</span>
          </nav>
          <span className="text-[11px] text-text-faint">{listings.length} listings</span>
        </div>
      </div>

      {/* LISTING GRID */}
      <main className="flex-1 bg-cream">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-4">
          {note && (
            <div className="mb-3 text-[11px] text-text-faint bg-surface border border-border rounded-lg px-3 py-2">
              {note}
            </div>
          )}

          {listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {listings.map((listing, i) => (
                <ListingCard key={listing.listing_id} listing={listing} featured={i === 0} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-text-faint">
              <p className="text-[13px]">No listings found.</p>
              <p className="text-[11px] mt-1">The API may be offline or no listings are seeded yet.</p>
            </div>
          )}

          {listings.length > 0 && (
            <div className="text-center mt-6 text-[11px] text-text-faint">
              Page 1 of 1 · {listings.length} listings
            </div>
          )}
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}
