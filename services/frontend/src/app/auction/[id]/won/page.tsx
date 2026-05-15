'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy, ShieldCheck, Check, Circle, ArrowRight } from 'lucide-react'
import VettingBadge from '@/components/ui/VettingBadge'
import StatusBadge from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import { paisaToRs } from '@/lib/formatters'
import type { ListingDetail, Transaction } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────
function feeCalc(bidPaisa: number) {
  const platformFee = Math.floor(bidPaisa * 2 / 100)
  const wht         = Math.floor(bidPaisa * 1 / 100)
  const total       = bidPaisa + platformFee + wht
  return { platformFee, wht, total }
}

// ── Main content ──────────────────────────────────────────────────────────────
function WonContent() {
  const params       = useParams()
  const searchParams = useSearchParams()

  const auctionId    = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const listingId    = searchParams.get('listing_id') ?? ''
  const txIdParam    = searchParams.get('transaction_id') ?? ''
  const bidPaisa     = parseInt(searchParams.get('bid_amount_paisa') ?? '0', 10)

  const [listing,     setListing]     = useState<ListingDetail | null>(null)
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [polling,     setPolling]     = useState(!txIdParam)
  const [attempts,    setAttempts]    = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch listing
  useEffect(() => {
    if (!listingId) return
    api.listings.get(listingId).then(setListing).catch(() => {})
  }, [listingId])

  // Fetch or poll for transaction
  useEffect(() => {
    if (txIdParam) {
      api.transactions.get(txIdParam).then(setTransaction).catch(() => {})
      return
    }
    // No txId — poll until transaction appears (max 5 attempts, 3s apart)
    intervalRef.current = setInterval(async () => {
      setAttempts(prev => {
        if (prev >= 5) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setPolling(false)
          return prev
        }
        return prev + 1
      })
    }, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [txIdParam])

  useEffect(() => {
    if (attempts >= 5) setPolling(false)
  }, [attempts])

  const { platformFee, wht, total } = feeCalc(
    transaction?.winning_bid_paisa ?? bidPaisa
  )
  const actualBid = transaction?.winning_bid_paisa ?? bidPaisa
  const txId      = transaction?.transaction_id ?? txIdParam

  return (
    <div className="flex flex-col min-h-screen bg-cream">

      {/* ── Hero ── */}
      <section className="bg-obs pb-6">
        <div className="max-w-[680px] mx-auto px-6 pt-10 pb-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-copper/20 flex items-center justify-center">
              <Trophy size={48} className="text-copper" strokeWidth={1.2} />
            </div>
          </div>
          <h1 className="font-serif text-[32px] text-white leading-tight">
            You won the auction!
          </h1>
          <p className="text-[13px] text-white/55 mt-2 max-w-[440px] mx-auto leading-relaxed">
            Congratulations — your bid has been accepted and escrow has been initiated
          </p>
          {actualBid > 0 && (
            <p className="font-mono text-[32px] font-semibold text-copper mt-4">
              {paisaToRs(actualBid)}
            </p>
          )}
        </div>
      </section>

      <main className="flex-1 max-w-[680px] mx-auto w-full px-6 py-6 space-y-4">

        {/* ── Transaction summary ── */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <p className="text-[12px] font-medium text-text-primary">Transaction summary</p>
            <StatusBadge status="PENDING_MEETUP" size="md" />
          </div>

          {/* Listing info */}
          {listing ? (
            <div className="flex items-start gap-3 mb-4 pb-4 border-b border-border">
              <div className="w-12 h-12 bg-obs-90 rounded-xl flex items-center justify-center flex-shrink-0 text-copper/40 text-[10px] font-mono">
                {listing.make.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-medium">{listing.make} {listing.model}</p>
                  {listing.vetting_classification && (
                    <VettingBadge classification={listing.vetting_classification} size="sm" />
                  )}
                </div>
                {listing.storage_gb && (
                  <p className="text-[11px] text-text-faint mt-0.5">
                    {listing.storage_gb} GB · {listing.color_variant ?? ''}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-14 rounded-xl bg-border animate-pulse mb-4" />
          )}

          {/* Financial breakdown */}
          <div className="space-y-2">
            {[
              { label: 'Winning bid',           value: paisaToRs(actualBid),    cls: 'font-medium' },
              { label: 'Platform fee (2%)',      value: `+ ${paisaToRs(platformFee)}`, cls: 'text-warning' },
              { label: 'WHT (1%)',               value: `+ ${paisaToRs(wht)}`,   cls: 'text-warning' },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-[12px]">
                <span className="text-text-faint">{row.label}</span>
                <span className={`font-mono ${row.cls}`}>{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between text-[13px] font-medium pt-2 border-t border-border">
              <span>Total from escrow</span>
              <span className="font-mono text-copper">{paisaToRs(total)}</span>
            </div>
          </div>

          {/* Tx ID */}
          {txId && (
            <p className="text-[10px] text-text-faint font-mono mt-3 pt-3 border-t border-border">
              TX ID: {txId.slice(-12).toUpperCase()}
            </p>
          )}
        </div>

        {/* ── Next steps timeline ── */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-[12px] font-medium mb-4">What happens next</p>
          <div className="space-y-4">
            {[
              {
                num: 1,
                title: 'Escrow held',
                desc: `${paisaToRs(total)} is now held securely in escrow`,
                done: true,
              },
              {
                num: 2,
                title: 'Coordinate meetup',
                desc: 'Agree on a time and location with the seller',
                active: true,
              },
              {
                num: 3,
                title: 'Scan & settle',
                desc: "Scan the seller's QR code to release payment",
                pending: true,
              },
            ].map((step, i) => (
              <div key={step.num} className="flex gap-3 items-start relative">
                {i < 2 && (
                  <div className="absolute left-3.5 top-7 bottom-0 w-px bg-border" />
                )}
                <div className={[
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                  step.done   ? 'bg-copper text-white' :
                  step.active ? 'bg-copper/10 border-2 border-copper' :
                                'bg-border',
                ].join(' ')}>
                  {step.done   ? <Check size={13} className="text-white" /> :
                   step.active ? <span className="w-2 h-2 rounded-full bg-copper animate-pulse" /> :
                                 <Circle size={11} className="text-text-faint" />}
                </div>
                <div className="pb-2">
                  <p className={`text-[13px] font-medium ${step.pending ? 'text-text-faint' : ''}`}>
                    {step.title}
                  </p>
                  <p className="text-[11px] text-text-faint mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Polling state ── */}
        {polling && (
          <div className="bg-copper/5 border border-copper/20 rounded-xl p-4 text-center">
            <div className="w-5 h-5 rounded-full border-2 border-copper border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-[12px] text-text-muted">Creating transaction record…</p>
            <p className="text-[10px] text-text-faint mt-0.5">Attempt {attempts + 1} of 5</p>
          </div>
        )}

        {/* ── Escrow notice ── */}
        <div className="bg-copper-light border border-copper-border rounded-xl p-3.5 flex gap-2.5">
          <ShieldCheck size={14} className="text-copper mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-obs leading-relaxed">
            Funds will remain in escrow until you physically verify the device and scan
            the seller&apos;s QR code. Your money is fully protected.
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-2.5 pb-4">
          <Link
            href={`/meetup/coordinate?transaction_id=${txId || ''}&auction_id=${auctionId}&listing_id=${listingId}`}
            className="w-full inline-flex items-center justify-center gap-2 bg-copper text-white px-6 py-3 rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
          >
            Coordinate Meetup
            <ArrowRight size={14} />
          </Link>
          {txId && (
            <Link
              href={`/transactions/${txId}`}
              className="w-full inline-flex items-center justify-center border border-border text-text-muted px-6 py-3 rounded-[9px] text-[13px] hover:bg-cream transition-colors"
            >
              View Transaction
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}

export default function AuctionWonPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-full max-w-[680px] px-6 space-y-3">
          <div className="h-48 rounded-xl bg-border animate-pulse" />
          <div className="h-64 rounded-xl bg-border animate-pulse" />
        </div>
      </div>
    }>
      <WonContent />
    </Suspense>
  )
}
