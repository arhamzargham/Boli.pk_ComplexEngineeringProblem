'use client'

import { Trophy } from 'lucide-react'
import { paisaToRs, relativeTime } from '@/lib/formatters'
import type { Bid } from '@/types'

interface Props {
  bid: Bid
  isYours?: boolean
  isNew?: boolean
}

export default function BidHistoryRow({ bid, isYours = false }: Props) {
  const isWinning = bid.status === 'WINNING' || bid.status === 'WON'

  const amountColor =
    isWinning ? 'text-success' :
    bid.status === 'OUTBID' ? 'text-text-faint' :
    'text-text-primary'

  const statusLabel =
    bid.status === 'WINNING'   ? 'Winning' :
    bid.status === 'WON'       ? 'Won'     :
    bid.status === 'OUTBID'    ? 'Outbid'  :
    bid.status === 'ACTIVE'    ? 'Active'  :
    bid.status === 'CANCELLED' ? 'Void'    : bid.status

  const maskedId =
    bid.bidder_id.length >= 6
      ? `${bid.bidder_id.slice(0, 4)}···${bid.bidder_id.slice(-2)}`
      : bid.bidder_id

  return (
    <div
      className={[
        'flex items-center gap-2.5 py-2 border-b border-border last:border-0',
        isYours ? 'bg-copper/5 rounded -mx-3.5 px-3.5' : '',
      ].join(' ')}
    >
      {/* Rank circle */}
      <div
        className={[
          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
          isWinning
            ? 'bg-success/15 text-success'
            : 'bg-cream text-text-faint border border-border',
        ].join(' ')}
      >
        {isWinning ? (
          <Trophy size={11} />
        ) : (
          <span className="text-[10px]">{bid.rank ?? 1}</span>
        )}
      </div>

      {/* Bidder info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium font-mono text-text-primary">{maskedId}</span>
          {isYours && (
            <span className="text-[9px] text-copper bg-copper/10 px-1.5 py-0.5 rounded ml-1.5">
              You
            </span>
          )}
        </div>
        <p className="text-[10px] text-text-faint">{relativeTime(bid.placed_at)}</p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className={`font-mono text-[13px] font-medium ${amountColor}`}>
          {paisaToRs(bid.bid_amount_paisa)}
        </p>
        <p className="text-[9px] text-text-faint">{statusLabel}</p>
      </div>
    </div>
  )
}
