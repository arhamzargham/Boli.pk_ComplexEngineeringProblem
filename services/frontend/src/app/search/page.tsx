'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Ghost } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import ListingCard from '@/components/listing/ListingCard'
import SkeletonCard from '@/components/ui/SkeletonCard'
import SearchBar from '@/components/listing/SearchBar'
import { api } from '@/lib/api'
import type { Listing } from '@/types'

function SearchResults() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!q.trim()) {
      setListings([])
      return
    }
    setLoading(true)
    setError(null)
    api.listings
      .list({ q, limit: 24 })
      .then(r => setListings(r.data))
      .catch(e => setError(e instanceof Error ? e.message : 'Search failed'))
      .finally(() => setLoading(false))
  }, [q])

  return (
    <main className="flex-1 bg-cream">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-6">

        {/* Breadcrumb */}
        <nav className="text-[11px] mb-4">
          <span className="text-copper">Home</span>
          <span className="text-text-faint mx-1.5">›</span>
          <span className="text-text-muted">
            {q ? `Search results for "${q}"` : 'Search'}
          </span>
        </nav>

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-[11px] text-danger mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : listings.length > 0 ? (
          <>
            <p className="text-[12px] text-text-faint mb-3">
              {listings.length} result{listings.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {listings.map((listing, i) => (
                <ListingCard key={listing.listing_id} listing={listing} featured={i === 0} />
              ))}
            </div>
          </>
        ) : q ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Ghost size={40} className="text-text-faint" strokeWidth={1.2} />
            <p className="text-[14px] font-medium text-text-muted">No listings found</p>
            <p className="text-[12px] text-text-faint">
              No results for &ldquo;{q}&rdquo; — try a different search term.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Ghost size={40} className="text-text-faint" strokeWidth={1.2} />
            <p className="text-[14px] font-medium text-text-muted">Start searching</p>
            <p className="text-[12px] text-text-faint">
              Enter a device name above to find listings.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

function SearchSkeleton() {
  return (
    <main className="flex-1 bg-cream">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </main>
  )
}

export default function SearchPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <section className="bg-obs">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8">
          <p className="text-[10px] font-medium tracking-widest uppercase text-copper mb-2">
            MARKETPLACE SEARCH
          </p>
          <h1 className="font-serif text-[22px] text-white mb-1">Find your device</h1>
          <SearchBar />
        </div>
      </section>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults />
      </Suspense>
      <StatsBar />
      <Footer />
    </div>
  )
}
