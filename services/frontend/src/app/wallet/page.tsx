'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import BalanceCard from '@/components/wallet/BalanceCard'
import TransactionRow, { type TxType } from '@/components/wallet/TransactionRow'
import KYCBadge from '@/components/ui/KYCBadge'
import { api } from '@/lib/api'
import { getAuth, isAuthenticated } from '@/lib/auth'
import { paisaToRs } from '@/lib/formatters'
import type { Wallet } from '@/types'

// Hardcoded transaction history matching seed data (API doesn't return ledger yet)
const STATIC_TXS: { title: string; date: string; amountPaisa: number; type: TxType; note?: string; txId: string }[] = [
  { title: 'Deposit — Admin funding',      date: '27 Apr 2026 · 09:00 AM', amountPaisa: 50_000_000, type: 'DEPOSIT',     txId: 'f1000001-0000-4000-8000-000000000001' },
  { title: 'Escrow lock — iPhone 14 Pro',  date: '30 Apr 2026 · 12:01 PM', amountPaisa: 22_440_000, type: 'ESCROW_LOCK', txId: 'f1000002-0000-4000-8000-000000000002' },
  { title: 'Escrow lock — iPhone 13',      date: '28 Apr 2026 · 10:01 AM', amountPaisa: 15_300_000, type: 'ESCROW_LOCK', txId: 'f1000003-0000-4000-8000-000000000003' },
  { title: 'Bid reserve — Galaxy A54',     date: '30 Apr 2026 · 08:30 AM', amountPaisa: 8_670_000,  type: 'BID_RESERVE', txId: 'f1000004-0000-4000-8000-000000000004' },
  { title: 'Bid release — Samsung S23',    date: '29 Apr 2026 · 06:15 PM', amountPaisa: 15_300_000, type: 'BID_RELEASE', note: 'Outbid', txId: 'f1000005-0000-4000-8000-000000000005' },
]

export default function WalletPage() {
  const router = useRouter()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kycTier, setKycTier] = useState<'BASIC' | 'FULL'>('FULL')

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    const auth = getAuth()
    if (auth?.kycTier) setKycTier(auth.kycTier as 'BASIC' | 'FULL')

    api.wallet
      .get()
      .then(setWallet)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load wallet'))
      .finally(() => setLoading(false))
  }, [router])

  // Exposure limit in paisa: FULL = Rs.2,000,000, BASIC = Rs.200,000
  const exposureLimit = kycTier === 'FULL' ? 200_000_000 : 20_000_000
  const exposurePct   = wallet ? Math.min(100, Math.round((wallet.daily_escrow_exposure_paisa / exposureLimit) * 100)) : 0
  const remaining     = wallet ? exposureLimit - wallet.daily_escrow_exposure_paisa : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-2.5 flex items-center justify-between">
          <nav className="text-[11px]" aria-label="Breadcrumb">
            <Link href="/" className="text-copper hover:underline">Home</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <span className="text-text-muted">Wallet</span>
          </nav>
          <div className="flex items-center gap-1.5 text-[11px] text-text-faint">
            KYC Tier:&nbsp;
            <KYCBadge tier={kycTier} />
            &nbsp;· Limit: {paisaToRs(exposureLimit)} / day
          </div>
        </div>
      </div>

      <main className="flex-1 bg-cream">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-4 space-y-3">

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-[11px] text-danger">
              {error}
            </div>
          )}

          {/* Balance grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl h-[100px] bg-border animate-pulse" />
              ))}
            </div>
          ) : wallet ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <BalanceCard type="available" paisa={wallet.available_paisa}           subtitle="Free to bid"        />
              <BalanceCard type="reserved"  paisa={wallet.reserved_paisa}            subtitle="Active bids"        />
              <BalanceCard type="escrow"    paisa={wallet.locked_paisa}              subtitle="2 active deals"     />
              <BalanceCard type="total"     paisa={wallet.total_deposited_paisa}     subtitle="Since account open" />
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button className="bg-obs text-white rounded-xl p-3.5 text-left hover:bg-obs-90 transition-colors">
              <p className="text-[13px] font-medium">Top Up Wallet</p>
              <p className="text-[10px] text-white/50 mt-0.5">Via Raast · JazzCash · Easypaisa</p>
            </button>
            <button className="bg-surface border border-border rounded-xl p-3.5 text-left hover:bg-cream transition-colors">
              <p className="text-[13px] font-medium text-text-primary">Withdraw Funds</p>
              <p className="text-[10px] text-text-faint mt-0.5">Min Rs. 200 · To IBAN on file</p>
            </button>
          </div>

          {/* Daily exposure */}
          {wallet && (
            <div className="bg-surface border border-border rounded-xl p-3.5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-medium text-text-primary">Daily escrow exposure</p>
                  <p className="text-[10px] text-text-faint mt-0.5">
                    Resets at midnight UTC · KYC tier: <span className="text-copper font-medium">{kycTier}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-medium font-mono text-text-primary">
                    {paisaToRs(wallet.daily_escrow_exposure_paisa)}
                  </p>
                  <p className="text-[9px] text-text-faint">of {paisaToRs(exposureLimit)} limit</p>
                </div>
              </div>
              <div className="h-1.5 bg-border rounded-full mt-3 mb-1.5 overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${exposurePct}%` }}
                />
              </div>
              <p className="text-[10px] text-text-faint">
                {exposurePct}% used · {paisaToRs(remaining)} remaining today
              </p>
            </div>
          )}

          {/* Transaction history */}
          <div className="bg-surface border border-border rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium text-text-primary">Recent transactions</p>
              <button className="text-[11px] text-copper hover:underline">View all</button>
            </div>
            <div className="border-t border-border">
              {STATIC_TXS.map((tx, i) => (
                <Link
                  key={i}
                  href={`/transactions/${tx.txId}`}
                  className="block hover:bg-cream rounded-lg transition-colors -mx-3.5 px-3.5"
                >
                  <TransactionRow {...tx} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}
