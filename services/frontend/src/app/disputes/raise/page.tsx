'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, AlertCircle, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import { paisaToRs } from '@/lib/formatters'
import { getAuth } from '@/lib/auth'
import type { Transaction } from '@/types'

const REASONS = [
  { value: 'DEVICE_NOT_AS_DESCRIBED', label: 'Device condition mismatch or not as described' },
  { value: 'IMEI_MISMATCH',           label: 'IMEI mismatch (different device than listed)' },
  { value: 'SELLER_NO_SHOW',          label: "Seller didn't show up to the meetup" },
  { value: 'BUYER_NO_SHOW',           label: "Buyer didn't show up to the meetup" },
  { value: 'QR_REFUSAL',              label: 'QR code scan was refused or failed' },
  { value: 'OTHER',                   label: 'Other issue' },
]

function RaiseDisputeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const txId = searchParams.get('transaction_id') ?? ''
  const auth = getAuth()

  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [txLoading, setTxLoading] = useState(true)

  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!txId) { setTxLoading(false); return }
    api.transactions.get(txId)
      .then(setTransaction)
      .catch(() => {})
      .finally(() => setTxLoading(false))
  }, [txId])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []).filter(
      f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024
    )
    const combined = [...evidenceFiles, ...incoming].slice(0, 3)
    // Revoke old URLs before replacing
    thumbnails.forEach(url => URL.revokeObjectURL(url))
    const newUrls = combined.map(f => URL.createObjectURL(f))
    setEvidenceFiles(combined)
    setThumbnails(newUrls)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(thumbnails[index])
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index))
    setThumbnails(prev => prev.filter((_, i) => i !== index))
  }

  const canSubmit = reason !== '' && description.length >= 50 && acknowledged && !submitting

  async function handleSubmit() {
    if (!canSubmit || !txId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await api.transactions.raiseDispute(txId, {
        reason,
        description,
      })
      router.push(`/disputes/${result.dispute_id}`)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit dispute')
      setSubmitting(false)
    }
  }

  const userRole = auth?.userId && transaction
    ? transaction.buyer_id === auth.userId
      ? 'Buyer'
      : transaction.seller_id === auth.userId
        ? 'Seller'
        : null
    : null

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-obs sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-[700px] mx-auto px-4 h-[52px] flex items-center gap-3">
          <button
            onClick={() => txId ? router.push(`/transactions/${txId}`) : router.back()}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-white">Raise a Dispute</p>
            <p className="text-[10px] text-white/45">Admin review within 48 hours</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[700px] mx-auto w-full px-4 py-5 space-y-4">

        {/* Warning banner */}
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-3.5 flex gap-2.5">
          <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-text-muted leading-relaxed">
            Disputes are reviewed within 48 hours. Escrow remains held until resolved.
          </p>
        </div>

        {/* Transaction summary */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-[12px] font-medium mb-3">Transaction</p>
          {txLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-border rounded animate-pulse w-3/4" />
              <div className="h-3 bg-border rounded animate-pulse w-1/2" />
            </div>
          ) : transaction ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-[14px] font-medium">{transaction.make} {transaction.model}</p>
                  <p className="font-mono text-[10px] text-text-faint mt-0.5">
                    {txId.slice(-8).toUpperCase()}
                  </p>
                </div>
                <StatusBadge status={transaction.status} size="sm" />
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text-faint">Transaction amount</span>
                <span className="font-mono font-medium">{paisaToRs(transaction.winning_bid_paisa)}</span>
              </div>
              {userRole && (
                <p className="text-[11px] text-text-faint">
                  You are the <span className="font-medium text-copper">{userRole}</span>
                </p>
              )}
            </div>
          ) : txId ? (
            <p className="text-[12px] text-text-faint">Could not load transaction</p>
          ) : (
            <p className="text-[12px] text-text-faint">No transaction ID provided</p>
          )}
        </div>

        {/* Dispute form */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <p className="text-[13px] font-medium">Dispute details</p>

          {/* Reason */}
          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1.5">
              Dispute reason *
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface"
            >
              <option value="">Select a reason…</option>
              {REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1.5">
              Description *
            </label>
            <textarea
              placeholder="Describe the issue in detail. Include specific facts — what was promised vs. what occurred."
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 500))}
              rows={5}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface resize-none"
            />
            <div className="flex items-center justify-between mt-1 gap-2">
              {description.length > 0 && description.length < 50 ? (
                <p className="text-[10px] text-danger">{50 - description.length} more characters needed</p>
              ) : (
                <span />
              )}
              <p className={`text-[10px] flex-shrink-0 ${description.length >= 490 ? 'text-warning' : 'text-text-faint'}`}>
                {description.length} / 500
              </p>
            </div>
          </div>

          {/* Evidence upload */}
          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">
              Supporting evidence <span className="font-normal">(optional)</span>
            </label>
            <p className="text-[10px] text-text-faint mb-2">
              Photos of the device, screenshots, or relevant documentation — max 3 files, 5 MB each
            </p>

            {thumbnails.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {thumbnails.map((thumb, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={`Evidence ${i + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-danger text-white rounded-full flex items-center justify-center"
                      aria-label={`Remove evidence ${i + 1}`}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {evidenceFiles.length < 3 && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="evidence-upload"
                />
                <label
                  htmlFor="evidence-upload"
                  className="inline-flex items-center gap-1.5 border border-dashed border-border rounded-lg px-4 py-2 text-[11px] text-text-faint hover:border-copper hover:text-copper cursor-pointer transition-colors"
                >
                  + Add photos ({evidenceFiles.length}/3)
                </label>
              </>
            )}
          </div>

          {/* Penalty acknowledgment */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              className="mt-0.5 flex-shrink-0 accent-copper"
            />
            <span className="text-[11px] text-text-muted leading-relaxed">
              I understand that raising a false dispute may result in a{' '}
              <span className="font-medium text-danger">Rs. 2,000 penalty</span> and account suspension.
            </span>
          </label>

          {/* Error */}
          {submitError && (
            <div className="flex items-start gap-1.5 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={12} className="text-danger mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-danger">{submitError}</p>
            </div>
          )}

          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            Submit Dispute →
          </Button>
        </div>

        <div className="text-center pb-4">
          <Link
            href={txId ? `/transactions/${txId}` : '/wallet'}
            className="text-[12px] text-copper hover:underline"
          >
            ← Back to Transaction
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function RaiseDisputePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
      </div>
    }>
      <RaiseDisputeContent />
    </Suspense>
  )
}
