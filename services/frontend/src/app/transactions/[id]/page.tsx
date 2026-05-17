'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, CheckCircle2, Circle, AlertTriangle } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import StatusBadge from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import { paisaToRs, formatDateTime } from '@/lib/formatters'
import { isAuthenticated } from '@/lib/auth'
import type { Transaction } from '@/types'

export default function TransactionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''

  const [tx, setTx] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }

    api.transactions.get(id)
      .then(setTx)
      .catch(e => setError(e instanceof Error ? e.message : 'Transaction not found'))
      .finally(() => setLoading(false))
  }, [id, router])

  const shortId = id.slice(-6).toUpperCase()

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="max-w-[860px] mx-auto px-6 py-8 space-y-3">
          {[200, 140, 160].map((h, i) => (
            <div key={i} className="rounded-xl bg-border animate-pulse" style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !tx) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-text-muted">{error ?? 'Transaction not found'}</p>
        <Link href="/wallet" className="text-[13px] text-copper hover:underline">
          ← Back to Wallet
        </Link>
      </div>
    )
  }

  const isSettled   = tx.status === 'SETTLED'
  const isCancelled = tx.status === 'CANCELLED' || tx.status === 'REFUNDED'

  const TIMELINE = [
    { label: 'Auction closed',       ts: tx.created_at },
    { label: 'Meetup confirmed',     ts: tx.meetup_confirmed_at ?? null },
    { label: 'QR scanned',           ts: (tx.status === 'QR_SCANNED' || isSettled) ? tx.settled_at ?? null : null },
    { label: 'Settlement complete',  ts: tx.settled_at ?? null },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-[860px] mx-auto px-6 py-2.5">
          <nav className="text-[11px]">
            <Link href="/" className="text-copper hover:underline">Home</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <Link href="/wallet" className="text-copper hover:underline">Wallet</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <span className="text-text-muted">Transaction #{shortId}</span>
          </nav>
        </div>
      </div>

      <main className="flex-1 bg-cream">
        <div className="max-w-[860px] mx-auto px-6 py-4 space-y-3">

          {/* Status card */}
          <div className="bg-surface border border-border rounded-xl p-4 flex justify-between items-start">
            <div>
              <p className="text-[10px] text-text-faint uppercase tracking-widest">Transaction</p>
              <p className="font-serif text-[20px] text-text-primary mt-1">
                {tx.make} {tx.model}
              </p>
              <p className="text-[10px] text-text-faint font-mono mt-0.5">
                ID: {tx.transaction_id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={tx.status} size="md" />
              <p className="text-[10px] text-text-faint mt-1">{formatDateTime(tx.created_at)}</p>
            </div>
          </div>

          {/* Financial breakdown */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-[12px] font-medium mb-3">Financial summary</p>
            <div className="space-y-0">
              {[
                { label: 'Winning bid',    value: paisaToRs(tx.winning_bid_paisa), cls: 'font-mono font-medium' },
                { label: 'Buyer fee (2%)', value: paisaToRs(tx.buyer_fee_paisa),   cls: 'font-mono text-warning' },
                { label: 'Withholding tax',value: paisaToRs(tx.wht_paisa),         cls: 'font-mono text-warning' },
                { label: 'ICT sales tax',  value: paisaToRs(tx.ict_paisa),         cls: 'font-mono text-warning' },
                { label: 'Net to seller',  value: paisaToRs(tx.net_to_seller_paisa), cls: 'font-mono font-medium text-success text-right' },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-2 border-b border-border last:border-0 text-[12px]">
                  <span className="text-text-muted">{row.label}</span>
                  <span className={row.cls}>{row.value}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-text-faint mt-2">
              Fees collected and remitted per FBR regulations
            </p>
          </div>

          {/* Timeline */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-[12px] font-medium mb-3">Timeline</p>
            <div className="space-y-0">
              {TIMELINE.map((ev, i) => (
                <div key={ev.label} className="flex gap-3 items-start relative pb-4 last:pb-0">
                  {/* Vertical connector */}
                  {i < TIMELINE.length - 1 && (
                    <div className="absolute left-3 top-7 bottom-0 w-px bg-border" />
                  )}
                  {/* Circle */}
                  <div className={[
                    'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                    ev.ts ? 'bg-success/15 text-success' : 'bg-border text-text-faint',
                  ].join(' ')}>
                    {ev.ts ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                  </div>
                  {/* Text */}
                  <div>
                    <p className="text-[12px] font-medium">{ev.label}</p>
                    <p className="text-[10px] text-text-faint mt-0.5">
                      {ev.ts ? formatDateTime(ev.ts) : 'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Receipt hash */}
          {tx.settlement_receipt_hash && (
            <div className="bg-obs rounded-xl p-3.5">
              <p className="text-[10px] text-white/40 uppercase mb-2">Settlement Receipt</p>
              <p className="font-mono text-[10px] text-copper break-all">
                {tx.settlement_receipt_hash}
              </p>
              <p className="text-[9px] text-white/30 mt-1">
                Verify at boli.pk/verify — non-repudiable cryptographic proof
              </p>
            </div>
          )}

          {/* Escrow notice */}
          {!isSettled && !isCancelled && (
            <div className="bg-copper-light border border-copper-border rounded-xl p-3 flex gap-2">
              <ShieldCheck size={13} className="text-copper mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-obs">Funds in escrow · Released at QR scan meetup</p>
            </div>
          )}

          {/* Actions */}
          {!isSettled && !isCancelled && (
            <div className="pb-2">
              <Link
                href={`/disputes/raise?transaction_id=${id}`}
                className="flex items-center gap-2 w-full border border-danger/30 text-danger px-4 py-3 rounded-[9px] text-[13px] hover:bg-danger/5 transition-colors"
              >
                <AlertTriangle size={14} />
                Raise Dispute
              </Link>
            </div>
          )}
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}
