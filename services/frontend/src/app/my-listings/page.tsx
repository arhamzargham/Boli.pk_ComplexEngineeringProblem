'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Package } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import VettingBadge from '@/components/ui/VettingBadge'
import StatusBadge from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import { paisaToRs, conditionLabel, formatDate } from '@/lib/formatters'
import { getAuth, isAuthenticated } from '@/lib/auth'
import type { Listing } from '@/types'

export default function MyListingsPage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }

    const auth = getAuth()
    api.listings.list({ limit: 50 })
      .then(res => {
        setListings(res.data.filter(l => l.seller_id === auth?.userId))
      })
      .catch(e => setFetchError(e instanceof Error ? e.message : 'Failed to load listings'))
      .finally(() => setLoading(false))
  }, [router])

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-2.5">
          <nav className="text-[11px]">
            <Link href="/" className="text-copper hover:underline">Home</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <span className="text-text-muted">My Listings</span>
          </nav>
        </div>
      </div>

      <main className="flex-1 bg-cream">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-6">

          {/* Page header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="font-serif text-[22px] text-text-primary">My Listings</h1>
              <p className="text-[11px] text-text-faint mt-0.5">
                {loading ? 'Loading…' : `${listings.length} listing${listings.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Link
              href="/sell/create"
              className="flex items-center gap-2 bg-copper text-white px-4 py-2 rounded-[9px]
                         text-[12px] font-medium hover:bg-copper/90 transition-colors"
            >
              <Plus size={14} />
              List a Device
            </Link>
          </div>

          {/* States */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[72px] bg-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : fetchError ? (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
              <p className="text-[13px] text-danger">{fetchError}</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-border flex items-center justify-center">
                <Package size={24} className="text-text-faint" strokeWidth={1.2} />
              </div>
              <div>
                <p className="text-[14px] font-medium text-text-primary">No listings yet</p>
                <p className="text-[11px] text-text-faint mt-1">
                  Start selling your device on Boli.pk
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {listings.map(listing => (
                <ListingRow key={listing.listing_id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}

function ListingRow({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.listing_id}`}
      className="flex items-center gap-4 bg-surface border border-border rounded-xl p-4
                 hover:border-copper/30 transition-colors group"
    >
      {/* Device icon */}
      <div className="w-10 h-10 rounded-lg bg-cream flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-medium text-text-faint uppercase">
          {listing.make.slice(0, 2)}
        </span>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-text-primary group-hover:text-copper transition-colors">
            {listing.make} {listing.model}
          </span>
          <StatusBadge status={listing.status} />
          {listing.vetting_classification && (
            <VettingBadge
              classification={listing.vetting_classification}
              score={listing.composite_score}
              size="sm"
            />
          )}
        </div>
        <p className="text-[11px] text-text-faint mt-0.5">
          {[
            listing.storage_gb ? `${listing.storage_gb} GB` : null,
            `Condition ${listing.condition_rating}/10`,
            conditionLabel(listing.condition_rating),
            listing.created_at ? formatDate(listing.created_at) : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <p className="text-[15px] font-medium font-mono text-copper">
          {paisaToRs(listing.reserve_price_paisa)}
        </p>
        <p className="text-[10px] text-text-faint">Reserve</p>
      </div>
    </Link>
  )
}
