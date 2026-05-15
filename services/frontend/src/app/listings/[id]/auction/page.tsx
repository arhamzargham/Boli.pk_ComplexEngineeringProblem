'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Smartphone, ArrowLeft, Wifi, WifiOff, ShieldCheck, Trophy, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import VettingBadge from '@/components/ui/VettingBadge'
import CountdownTimer from '@/components/auction/CountdownTimer'
import BidHistoryRow from '@/components/auction/BidHistoryRow'
import BidPanel from '@/components/auction/BidPanel'
import { api } from '@/lib/api'
import { paisaToRs, conditionLabel } from '@/lib/formatters'
import { getAuth, isAuthenticated } from '@/lib/auth'
import { useCentrifugo } from '@/hooks/useCentrifugo'
import type { ListingDetail, Auction, Bid } from '@/types'

function AuctionRoomInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const listingId = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const auctionId = searchParams.get('auctionId') ?? ''

  const [listing, setListing] = useState<ListingDetail | null>(null)
  const [auction, setAuction] = useState<Auction | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [availablePaisa, setAvailablePaisa] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auctionEnded, setAuctionEnded] = useState(false)
  const [pollOk, setPollOk] = useState(true)

  const auth = getAuth()
  const authed = isAuthenticated()

  const fetchAuctionData = useCallback(async () => {
    try {
      const [auctionData, bidsData] = await Promise.all([
        api.auctions.get(auctionId),
        api.auctions.getBids(auctionId),
      ])
      setAuction(auctionData)
      setBids(bidsData.data.map((b, i) => ({ ...b, rank: i + 1 })))
      setPollOk(true)
    } catch {
      setPollOk(false)
    }
  }, [auctionId])

  useEffect(() => {
    if (!auctionId) {
      setError('No auction ID provided')
      setLoading(false)
      return
    }

    async function init() {
      try {
        const fetches: Promise<unknown>[] = [
          api.listings.get(listingId).then(setListing),
          api.auctions.get(auctionId).then(setAuction),
          api.auctions.getBids(auctionId).then(r => setBids(r.data.map((b, i) => ({ ...b, rank: i + 1 })))),
        ]
        if (authed) {
          fetches.push(api.wallet.get().then(w => setAvailablePaisa(w.available_paisa)))
        }
        await Promise.all(fetches)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load auction')
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [listingId, auctionId, authed])

  // Poll every 5s
  useEffect(() => {
    if (!auctionId || loading) return
    const id = setInterval(() => void fetchAuctionData(), 5000)
    return () => clearInterval(id)
  }, [auctionId, loading, fetchAuctionData])

  // Real-time bid updates via Centrifugo WebSocket
  useCentrifugo({
    auctionId,
    onBid: (event) => {
      setBids(prev => [{
        bid_id:          `ws-${Date.now()}`,
        auction_id:      event.auction_id,
        bidder_id:       event.bidder_id,
        bid_amount_paisa: event.amount_paisa,
        status:          'ACTIVE' as const,
        placed_at:       new Date().toISOString(),
      }, ...prev])
      setAuction(prev =>
        prev && event.amount_paisa > (prev.highest_bid_paisa ?? 0)
          ? { ...prev, highest_bid_paisa: event.amount_paisa, total_bid_count: prev.total_bid_count + 1 }
          : prev
      )
    },
  })

  const handleBidPlaced = useCallback(async () => {
    await fetchAuctionData()
    if (authed) {
      api.wallet.get().then(w => setAvailablePaisa(w.available_paisa)).catch(() => {})
    }
  }, [fetchAuctionData, authed])

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="space-y-2 w-full max-w-[360px] px-4">
          <div className="h-[200px] rounded-xl bg-border animate-pulse" />
          <div className="h-[100px] rounded-xl bg-border animate-pulse" />
          <div className="h-[100px] rounded-xl bg-border animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !auction) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-text-muted">{error ?? 'Auction not found'}</p>
        <button
          onClick={() => router.push(`/listings/${listingId}`)}
          className="text-[13px] text-copper hover:underline"
        >
          ← Back to listing
        </button>
      </div>
    )
  }

  const currentHighBid = auction.highest_bid_paisa ?? 0

  // Detect if the current user is the winning bidder
  const isWinner = authed &&
    (auction.status === 'CLOSED_WITH_BIDS') &&
    bids.some(b =>
      (b.status === 'WINNING' || b.status === 'WON') &&
      b.bidder_id === auth?.userId
    )

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Slim header */}
      <header className="sticky top-0 z-50 bg-obs border-b border-white/5">
        <div className="max-w-[1280px] mx-auto px-4 md:px-10 h-[52px] flex items-center gap-3">
          <button
            onClick={() => router.push(`/listings/${listingId}`)}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to listing"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-obs-90 rounded flex items-center justify-center flex-shrink-0">
              <Smartphone size={14} className="text-copper/60" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white truncate">
                {listing ? `${listing.make} ${listing.model}` : auction.make + ' ' + auction.model}
              </p>
              <p className="text-[10px] text-white/45">Live Auction Room</p>
            </div>
          </div>

          {/* Connection status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] flex-shrink-0 ${
              pollOk ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
            }`}
          >
            {pollOk ? <Wifi size={10} /> : <WifiOff size={10} />}
            <span>{pollOk ? 'Live' : 'Reconnecting'}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-4">

            {/* LEFT COLUMN */}
            <div className="space-y-3">

              {/* Listing summary */}
              {listing && (
                <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3">
                  <div className="w-16 h-16 bg-obs-90 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Smartphone size={24} className="text-copper/40" strokeWidth={1.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[15px]">{listing.make} {listing.model}</span>
                      {listing.vetting_classification && (
                        <VettingBadge
                          classification={listing.vetting_classification}
                          score={listing.composite_score}
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-text-faint mt-1">
                      {[
                        listing.storage_gb ? `${listing.storage_gb} GB` : null,
                        listing.color_variant,
                        `${listing.condition_rating}/10`,
                        conditionLabel(listing.condition_rating),
                      ].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-[11px] mt-0.5">
                      Reserve: <span className="font-mono font-medium">{paisaToRs(listing.reserve_price_paisa)}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Live stats */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    label: 'HIGHEST BID',
                    value: currentHighBid > 0 ? paisaToRs(currentHighBid) : '—',
                    accent: true,
                  },
                  {
                    label: 'TOTAL BIDS',
                    value: String(auction.total_bid_count),
                    accent: false,
                  },
                  {
                    label: 'RESERVE',
                    value: paisaToRs(auction.reserve_price_paisa),
                    accent: false,
                  },
                ].map(stat => (
                  <div key={stat.label} className="bg-surface border border-border rounded-xl p-3">
                    <p className="text-[9px] text-text-faint uppercase tracking-wider mb-1">{stat.label}</p>
                    <p className={`text-[15px] font-medium font-mono ${stat.accent ? 'text-copper' : ''}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Countdown */}
              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-[10px] text-text-faint uppercase tracking-widest mb-3">
                  {auctionEnded ? 'AUCTION ENDED' : 'TIME REMAINING'}
                </p>
                <CountdownTimer
                  endTime={auction.end_time}
                  size="lg"
                  onEnd={() => setAuctionEnded(true)}
                />
                {!auctionEnded && (
                  <p className="text-[10px] text-text-faint mt-3">
                    Any bid placed in the last 5 minutes extends the auction by 5 minutes
                  </p>
                )}
              </div>

              {/* Bid history */}
              <div className="bg-surface border border-border rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-medium">Bid history</p>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <span className="text-[11px] font-medium text-copper uppercase tracking-wide">Live</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-faint">
                    {auction.total_bid_count} bids · refreshes every 5s
                  </p>
                </div>

                {bids.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-[11px] text-text-faint">No bids yet — be the first to bid!</p>
                  </div>
                ) : (
                  <div>
                    {bids.map((bid, i) => (
                      <BidHistoryRow
                        key={bid.bid_id}
                        bid={bid}
                        isYours={bid.bidder_id === auth?.userId}
                        isNew={i === 0}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-3 md:sticky md:top-[68px] self-start">

              {/* Winner banner — shown when current user is the winning bidder */}
              {isWinner && (
                <div className="bg-copper/10 border-2 border-copper rounded-xl p-4 text-center">
                  <Trophy size={28} className="text-copper mx-auto mb-2" strokeWidth={1.5} />
                  <p className="font-serif text-[18px] text-text-primary">You won!</p>
                  <p className="text-[11px] text-text-faint mt-1 mb-3">
                    Your bid of {paisaToRs(currentHighBid)} was accepted. Escrow is active.
                  </p>
                  <Link
                    href={`/auction/${auctionId}/won?bid_amount_paisa=${currentHighBid}&listing_id=${listingId}`}
                    className="w-full inline-flex items-center justify-center gap-2 bg-copper text-white px-4 py-2.5 rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
                  >
                    Claim Your Win
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}

              <BidPanel
                auctionId={auctionId}
                currentHighBidPaisa={currentHighBid}
                reservePricePaisa={auction.reserve_price_paisa}
                availableWalletPaisa={availablePaisa}
                isAuthenticated={authed}
                auctionEnded={auctionEnded}
                onBidPlaced={handleBidPlaced}
              />

              {/* Fee structure */}
              <div className="bg-cream border border-border rounded-xl p-3">
                <p className="text-[10px] text-text-faint uppercase tracking-wider mb-2">
                  Fee Structure
                </p>
                <div className="space-y-1.5">
                  {[
                    ['Buyer platform fee', '2%'],
                    ['Seller platform fee', '2%'],
                    ['Withholding tax (WHT)', '1% of bid'],
                    ['ICT sales tax', '15% of platform fees'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-[11px]">
                      <span className="text-text-faint">{label}</span>
                      <span className="font-mono">{val}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-text-faint mt-2 leading-relaxed">
                  All fees deducted from escrowed funds at settlement.
                  NTN required for transactions above Rs. 50,000.
                </p>
              </div>

              {/* Escrow notice */}
              <div className="bg-copper-light border border-copper-border rounded-xl p-3 flex gap-2.5">
                <ShieldCheck size={13} className="text-copper mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-obs leading-relaxed">
                  Winning bid funds are moved to escrow. Released only on IMEI verification
                  + cryptographic QR scan at meetup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="space-y-2 w-full max-w-[360px] px-4">
        <div className="h-[200px] rounded-xl bg-border animate-pulse" />
        <div className="h-[100px] rounded-xl bg-border animate-pulse" />
        <div className="h-[100px] rounded-xl bg-border animate-pulse" />
      </div>
    </div>
  )
}

export default function AuctionRoomPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AuctionRoomInner />
    </Suspense>
  )
}
