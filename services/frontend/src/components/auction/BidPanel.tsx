'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ShieldCheck, Info } from 'lucide-react'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'
import { paisaToRs } from '@/lib/formatters'

interface Props {
  auctionId: string
  currentHighBidPaisa: number
  reservePricePaisa: number
  availableWalletPaisa: number
  isAuthenticated: boolean
  auctionEnded: boolean
  onBidPlaced: () => void
}

export default function BidPanel({
  auctionId,
  currentHighBidPaisa,
  reservePricePaisa,
  availableWalletPaisa,
  isAuthenticated,
  auctionEnded,
  onBidPlaced,
}: Props) {
  const [inputRs, setInputRs] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const minBid = Math.max(
    reservePricePaisa,
    currentHighBidPaisa > 0 ? currentHighBidPaisa + 50000 : 0,
  )

  const rawInt = parseInt(inputRs.replace(/,/g, ''), 10)
  const bidPaisa = isNaN(rawInt) ? 0 : rawInt * 100
  const platformFeePaisa = Math.floor(bidPaisa * 2 / 100)
  const totalReservedPaisa = bidPaisa + platformFeePaisa
  const canAfford = availableWalletPaisa >= totalReservedPaisa
  const isValidBid = bidPaisa >= minBid

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await api.auctions.placeBid(auctionId, bidPaisa)
      setSuccess(`Bid of ${paisaToRs(bidPaisa)} placed! Funds reserved.`)
      setInputRs('')
      onBidPlaced()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to place bid')
    } finally {
      setLoading(false)
    }
  }

  if (auctionEnded) {
    return (
      <div className="bg-cream border border-border rounded-xl p-4 text-center">
        <p className="text-[13px] font-medium text-text-muted">Auction has ended</p>
        <p className="text-[11px] text-text-faint mt-1">
          Winner will be contacted for meetup coordination
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-cream border border-border rounded-xl p-4 text-center">
        <p className="text-[13px] font-medium">Login to place a bid</p>
        <p className="text-[11px] text-text-faint mt-1 mb-3">
          Funds reserved from wallet · Released if outbid
        </p>
        <Link
          href="/login"
          className="block w-full bg-copper text-white text-center py-2.5 rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
        >
          Login to Bid
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-3.5">
      <p className="text-[11px] uppercase tracking-widest text-text-faint mb-2.5">
        Place your bid
      </p>

      {/* Current high bid + minimum */}
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-[11px]">
          <span className="text-text-faint">Current highest bid</span>
          <span className="font-mono font-medium">
            {currentHighBidPaisa > 0 ? paisaToRs(currentHighBidPaisa) : '—'}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-copper">Minimum bid</span>
          <span className="font-mono font-medium text-copper">{paisaToRs(minBid)}</span>
        </div>
      </div>

      {/* Bid input */}
      <label className="text-[11px] font-medium text-text-muted block mb-1.5">
        Your bid (Rs.)
      </label>
      <div className="flex border border-border rounded-lg overflow-hidden focus-within:border-copper transition-colors">
        <div className="bg-cream px-3 flex items-center border-r border-border flex-shrink-0">
          <span className="text-[12px] text-text-muted font-medium">Rs.</span>
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={inputRs}
          placeholder={Math.floor(minBid / 100).toLocaleString()}
          onChange={e => {
            setInputRs(e.target.value.replace(/[^\d]/g, ''))
            setError(null)
            setSuccess(null)
          }}
          onKeyDown={e => e.key === 'Enter' && isValidBid && canAfford && handleSubmit()}
          className="flex-1 px-3 py-2.5 text-[13px] font-mono focus:outline-none bg-transparent"
        />
      </div>

      {/* Fee breakdown — only when bid > 0 */}
      {bidPaisa > 0 && (
        <div className="bg-cream rounded-lg p-2.5 mt-2 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-text-faint">Your bid</span>
            <span className="font-mono">{paisaToRs(bidPaisa)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-text-faint">Platform fee (2%)</span>
            <span className="font-mono">+{paisaToRs(platformFeePaisa)}</span>
          </div>
          <div className="border-t border-border pt-1">
            <div className="flex justify-between text-[11px] font-medium">
              <span>Total reserved</span>
              <div className="text-right">
                <span className={`font-mono ${!canAfford ? 'text-danger' : ''}`}>
                  {paisaToRs(totalReservedPaisa)}
                </span>
                {!canAfford && (
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <AlertCircle size={10} className="text-danger" />
                    <span className="text-[10px] text-danger">Insufficient balance</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet balance row */}
      <div className="flex justify-between text-[10px] mt-2">
        <div className="flex items-center gap-1 text-text-faint">
          <Info size={10} />
          <span>Your available balance</span>
        </div>
        <span className="font-mono font-medium text-copper">
          {paisaToRs(availableWalletPaisa)}
        </span>
      </div>

      {/* Inline error */}
      {error && (
        <div className="flex items-center gap-1.5 mt-2">
          <AlertCircle size={11} className="text-danger flex-shrink-0" />
          <span className="text-[11px] text-danger">{error}</span>
        </div>
      )}

      {/* Inline success */}
      {success && (
        <div className="flex items-center gap-1.5 mt-2">
          <ShieldCheck size={11} className="text-success flex-shrink-0" />
          <span className="text-[11px] text-success">{success}</span>
        </div>
      )}

      <Button
        variant="primary"
        size="md"
        fullWidth
        loading={loading}
        disabled={!isValidBid || !canAfford || bidPaisa === 0}
        onClick={handleSubmit}
        className="mt-3"
      >
        {bidPaisa > 0 ? `Place Bid · ${paisaToRs(bidPaisa)}` : 'Place Bid'}
      </Button>

      <div className="flex items-center gap-1.5 mt-3">
        <ShieldCheck size={11} className="text-copper flex-shrink-0" />
        <p className="text-[10px] text-text-faint leading-relaxed">
          Funds reserved immediately · Released if outbid · Escrowed if you win
        </p>
      </div>
    </div>
  )
}
