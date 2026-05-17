'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useNotifications } from '@/lib/notifications'

function SettlementContent() {
  const searchParams = useSearchParams()
  const txId      = searchParams.get('transaction_id') ?? ''
  const isSuccess = searchParams.get('status') === 'success'

  const { addNotification } = useNotifications()

  useEffect(() => {
    if (isSuccess && txId) {
      addNotification({
        type:           'settled',
        title:          'Settlement complete',
        message:        'Escrow funds have been released to the seller.',
        transaction_id: txId,
        href:           `/transactions/${txId}`,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, txId])

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-xl shadow-raised p-8 w-full max-w-[420px] text-center">

        {/* Status icon */}
        <div className="flex justify-center mb-4">
          {isSuccess ? (
            <CheckCircle2 size={52} className="text-copper" strokeWidth={1.5} />
          ) : (
            <XCircle size={52} className="text-danger" strokeWidth={1.5} />
          )}
        </div>

        {/* Heading */}
        <h1 className="font-serif text-[24px] text-text-primary">
          {isSuccess ? 'Settlement Complete' : 'Settlement Failed'}
        </h1>

        {/* Subheading */}
        <p className="text-[13px] text-text-muted mt-2">
          {isSuccess
            ? 'Funds have been released to the seller.'
            : 'Please contact support for assistance.'}
        </p>

        {/* Transaction ID */}
        {txId && (
          <div className="mt-5 bg-cream border border-border rounded-lg px-4 py-3">
            <p className="text-[10px] text-text-faint uppercase tracking-wider mb-1">
              Transaction ID
            </p>
            <p className="font-mono text-[12px] text-text-primary break-all">{txId}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2.5 mt-6">
          {txId && (
            <Link
              href={`/transactions/${txId}`}
              className="block w-full bg-copper text-white text-[13px] font-medium py-2.5 rounded-[9px] hover:bg-copper/90 transition-colors"
            >
              View Transaction
            </Link>
          )}
          <Link
            href="/"
            className="block w-full border border-border text-[13px] text-text-muted py-2.5 rounded-[9px] hover:bg-cream transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function SettlementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
      </div>
    }>
      <SettlementContent />
    </Suspense>
  )
}
