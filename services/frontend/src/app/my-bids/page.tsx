'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gavel, Info } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import { isAuthenticated } from '@/lib/auth'

const COLUMNS = ['Device', 'Auction', 'Bid Amount', 'Status', 'Date']

export default function MyBidsPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
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
            <span className="text-text-muted">My Bids</span>
          </nav>
        </div>
      </div>

      <main className="flex-1 bg-cream">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-6">

          {/* Page header */}
          <div className="mb-5">
            <h1 className="font-serif text-[22px] text-text-primary">My Bids</h1>
            <p className="text-[11px] text-text-faint mt-0.5">
              Your auction bid history
            </p>
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-2.5 bg-surface border border-border rounded-xl p-4 mb-5">
            <Info size={14} className="text-copper mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-text-primary">Bid history loading from auction system</p>
              <p className="text-[11px] text-text-faint mt-0.5">
                Full bid history will appear here once the real-time auction WebSocket feed is connected.
                To see your current bids, visit an auction room directly.
              </p>
              <Link
                href="/"
                className="inline-block mt-2 text-[11px] text-copper hover:underline"
              >
                Browse marketplace →
              </Link>
            </div>
          </div>

          {/* Table skeleton */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-border bg-cream">
              {COLUMNS.map(col => (
                <p key={col} className="text-[10px] font-medium text-text-faint uppercase tracking-wider">
                  {col}
                </p>
              ))}
            </div>

            {/* Placeholder row */}
            <div className="grid grid-cols-5 gap-4 px-4 py-4 items-center">
              <div className="flex items-center gap-2 col-span-2">
                <Gavel size={14} className="text-text-faint flex-shrink-0" />
                <p className="text-[12px] text-text-faint italic">
                  Bid history will appear here once the auction WebSocket feed is connected.
                </p>
              </div>
              <div />
              <div />
              <div />
            </div>

            {/* Empty rows skeleton */}
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="grid grid-cols-5 gap-4 px-4 py-3.5 border-t border-border items-center"
              >
                {COLUMNS.map(col => (
                  <div
                    key={col}
                    className="h-3 bg-border rounded animate-pulse"
                    style={{ width: `${60 + (i * 10) % 30}%` }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Link to marketplace */}
          <div className="mt-6 text-center">
            <p className="text-[11px] text-text-faint mb-2">
              Looking for active auctions to bid on?
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-copper text-white px-5 py-2.5
                         rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
            >
              <Gavel size={14} />
              Browse Marketplace
            </Link>
          </div>
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}
