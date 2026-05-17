'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, Circle, Clock,
  AlertTriangle, AlertCircle, X, ShieldCheck,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import { paisaToRs, formatDateTime } from '@/lib/formatters'
import type { Dispute } from '@/types'

const REASON_LABELS: Record<string, string> = {
  device_condition_mismatch: 'Device condition mismatch',
  imei_mismatch:             'IMEI mismatch',
  device_not_received:       'Device not received',
  device_not_as_described:   'Device not as described',
  payment_not_released:      'Payment not released',
  IMEI_MISMATCH:             'IMEI mismatch',
  QR_REFUSAL:                'QR refusal',
  ITEM_NOT_AS_DESCRIBED:     'Item not as described',
  FRAUDULENT_REVERSAL:       'Fraudulent reversal',
  MEETUP_FAILED:             'Meetup failed',
  SELLER_NO_SHOW:            'Seller no-show',
  DIRBS_BLACKLISTED_AT_MEETUP: 'DIRBS blacklisted at meetup',
  other:                     'Other',
}

export default function DisputeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const disputeId = typeof params.id === 'string' ? params.id : ''

  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Response form
  const [responseText, setResponseText] = useState('')
  const [responseFiles, setResponseFiles] = useState<File[]>([])
  const [responseThumbs, setResponseThumbs] = useState<string[]>([])
  const [submittingResponse, setSubmittingResponse] = useState(false)
  const [responseSuccess, setResponseSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!disputeId) { setFetchError('Dispute not found'); setLoading(false); return }
    api.disputes.get(disputeId)
      .then(setDispute)
      .catch(e => setFetchError(e instanceof Error ? e.message : 'Dispute not found'))
      .finally(() => setLoading(false))
  }, [disputeId])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []).filter(
      f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024
    )
    const combined = [...responseFiles, ...incoming].slice(0, 3)
    responseThumbs.forEach(url => URL.revokeObjectURL(url))
    const newUrls = combined.map(f => URL.createObjectURL(f))
    setResponseFiles(combined)
    setResponseThumbs(newUrls)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(responseThumbs[index])
    setResponseFiles(prev => prev.filter((_, i) => i !== index))
    setResponseThumbs(prev => prev.filter((_, i) => i !== index))
  }

  async function handleResponseSubmit() {
    if (!responseText.trim() || submittingResponse) return
    setSubmittingResponse(true)
    await new Promise<void>(resolve => setTimeout(resolve, 800))
    setResponseSuccess(true)
    setSubmittingResponse(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="max-w-[1000px] mx-auto px-6 py-8 space-y-3">
          {([200, 160, 140] as const).map(h => (
            <div key={h} className="rounded-xl bg-border animate-pulse" style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>
    )
  }

  if (fetchError || !dispute) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-text-muted">{fetchError ?? 'Dispute not found'}</p>
        <button onClick={() => router.back()} className="text-[13px] text-copper hover:underline">
          ← Go back
        </button>
      </div>
    )
  }

  const isResolved   = dispute.status === 'RESOLVED' || dispute.status === 'DISMISSED'
  const isUnderReview = dispute.status === 'UNDER_REVIEW'
  const shortId      = disputeId.slice(-8).toUpperCase()

  const TIMELINE = [
    {
      label: 'Dispute Raised',
      desc:  'Escrow placed on hold',
      ts:    dispute.created_at,
      done:  true,
    },
    {
      label: 'Under Review',
      desc:  'Admin reviewing evidence',
      ts:    dispute.status !== 'OPEN' ? dispute.updated_at : null,
      done:  dispute.status !== 'OPEN',
    },
    {
      label: 'Resolution',
      desc:  'Admin decision issued',
      ts:    isResolved ? dispute.updated_at : null,
      done:  isResolved,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-obs sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-[1000px] mx-auto px-4 h-[52px] flex items-center gap-3">
          <button
            onClick={() => dispute.transaction_id ? router.push(`/transactions/${dispute.transaction_id}`) : router.back()}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <p className="text-[14px] font-medium text-white">Dispute</p>
            <p className="font-mono text-[10px] text-white/40">#{shortId}</p>
          </div>
          <StatusBadge status={dispute.status} size="sm" />
        </div>
      </header>

      <main className="flex-1 max-w-[1000px] mx-auto w-full px-4 py-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">

          {/* LEFT — Details */}
          <div className="space-y-4">

            {/* Dispute info */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-[12px] font-medium mb-3">Dispute information</p>
              <div className="space-y-0">
                {[
                  {
                    label: 'Raised by',
                    value: dispute.raised_by === 'BUYER' ? 'Buyer'
                      : dispute.raised_by === 'SELLER' ? 'Seller'
                      : 'System',
                  },
                  { label: 'Raised on',  value: formatDateTime(dispute.created_at) },
                  { label: 'Reason',     value: REASON_LABELS[dispute.reason] ?? dispute.reason },
                  ...(dispute.winning_bid_paisa
                    ? [{ label: 'Transaction amount', value: paisaToRs(dispute.winning_bid_paisa) }]
                    : []
                  ),
                ].map(row => (
                  <div key={row.label} className="flex items-start justify-between gap-4 text-[12px] py-2 border-b border-border last:border-0">
                    <span className="text-text-faint flex-shrink-0">{row.label}</span>
                    <span className="font-medium text-right">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[12px] py-2">
                  <span className="text-text-faint">Transaction ID</span>
                  <Link
                    href={`/transactions/${dispute.transaction_id}`}
                    className="font-mono text-copper hover:underline"
                  >
                    {dispute.transaction_id.slice(-8).toUpperCase()}
                  </Link>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-[12px] font-medium mb-2">Description</p>
              <p className="text-[13px] text-text-muted leading-relaxed whitespace-pre-wrap">
                {dispute.description}
              </p>
            </div>

            {/* Timeline stepper */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-[12px] font-medium mb-4">Status timeline</p>
              <div className="space-y-0">
                {TIMELINE.map((step, i) => (
                  <div key={step.label} className="flex gap-3 items-start relative pb-5 last:pb-0">
                    {i < TIMELINE.length - 1 && (
                      <div className="absolute left-3 top-7 bottom-0 w-px bg-border" />
                    )}
                    <div className={[
                      'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                      step.done
                        ? 'bg-copper/10 text-copper'
                        : 'bg-border text-text-faint',
                    ].join(' ')}>
                      {step.done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">{step.label}</p>
                      <p className="text-[10px] text-text-faint mt-0.5">{step.desc}</p>
                      {step.ts && (
                        <p className="text-[10px] text-copper mt-0.5">{formatDateTime(step.ts)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response section — only when UNDER_REVIEW */}
            {isUnderReview && (
              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <p className="text-[12px] font-medium">Add a response</p>
                <p className="text-[11px] text-text-faint">
                  Provide additional context or attach supporting evidence.
                </p>

                {responseSuccess ? (
                  <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-lg px-3 py-2.5">
                    <CheckCircle2 size={13} className="text-success flex-shrink-0" />
                    <p className="text-[12px] text-success">Response submitted successfully</p>
                  </div>
                ) : (
                  <>
                    <textarea
                      placeholder="Add a response or additional evidence…"
                      value={responseText}
                      onChange={e => setResponseText(e.target.value)}
                      rows={3}
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-[12px] focus:outline-none focus:border-copper bg-surface resize-none"
                    />

                    {responseThumbs.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {responseThumbs.map((thumb, i) => (
                          <div key={i} className="relative flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumb}
                              alt={`Response evidence ${i + 1}`}
                              className="w-14 h-14 object-cover rounded-lg border border-border"
                            />
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-danger text-white rounded-full flex items-center justify-center"
                              aria-label={`Remove file ${i + 1}`}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {responseFiles.length < 3 && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          id="response-upload"
                        />
                        <label
                          htmlFor="response-upload"
                          className="inline-flex items-center gap-1.5 border border-dashed border-border rounded-lg px-3 py-2 text-[11px] text-text-faint hover:border-copper hover:text-copper cursor-pointer transition-colors"
                        >
                          + Attach photos ({responseFiles.length}/3)
                        </label>
                      </>
                    )}

                    <Button
                      variant="secondary"
                      size="md"
                      loading={submittingResponse}
                      disabled={!responseText.trim()}
                      onClick={() => void handleResponseSubmit()}
                    >
                      Submit Response
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Resolution card */}
          <div className="space-y-3 md:sticky md:top-[68px] self-start">

            {(dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW') && (
              <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
                <div className="flex items-start gap-2.5 mb-3">
                  <Clock size={14} className="text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-text-muted leading-relaxed">
                    Our team is reviewing this dispute. You will be notified within{' '}
                    <span className="font-medium">48 hours</span>.
                  </p>
                </div>
                {dispute.winning_bid_paisa && (
                  <div className="bg-surface border border-border rounded-lg px-3 py-2.5 flex items-center gap-2 mb-3">
                    <ShieldCheck size={12} className="text-copper flex-shrink-0" />
                    <p className="text-[11px] text-text-muted">
                      <span className="font-mono font-medium text-copper">
                        {paisaToRs(dispute.winning_bid_paisa)}
                      </span>{' '}
                      held in escrow pending resolution
                    </p>
                  </div>
                )}
                <Link
                  href={`/transactions/${dispute.transaction_id}`}
                  className="text-[11px] text-copper hover:underline"
                >
                  View Transaction →
                </Link>
              </div>
            )}

            {dispute.status === 'RESOLVED' && (
              <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                <div className="flex items-start gap-2.5 mb-3">
                  <CheckCircle2 size={14} className="text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium text-success">Dispute resolved</p>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                      {dispute.resolution_note ?? 'Admin has issued a resolution. Check your transaction for details.'}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/transactions/${dispute.transaction_id}`}
                  className="text-[11px] text-copper hover:underline"
                >
                  View Transaction →
                </Link>
              </div>
            )}

            {dispute.status === 'DISMISSED' && (
              <div className="bg-danger/5 border border-danger/20 rounded-xl p-4">
                <div className="flex items-start gap-2.5 mb-3">
                  <AlertCircle size={14} className="text-danger mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium text-danger">Dispute dismissed</p>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                      {dispute.resolution_note ?? 'This dispute was reviewed and dismissed by admin.'}
                    </p>
                  </div>
                </div>
                <div className="bg-danger/10 rounded-lg px-3 py-2 mb-3">
                  <p className="text-[11px] text-danger font-medium">
                    Rs. 2,000 penalty has been applied to your account.
                  </p>
                </div>
                <Link
                  href={`/transactions/${dispute.transaction_id}`}
                  className="text-[11px] text-copper hover:underline"
                >
                  View Transaction →
                </Link>
              </div>
            )}

            {/* Dispute ID */}
            <div className="bg-obs rounded-xl p-3.5">
              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1.5">Dispute ID</p>
              <p className="font-mono text-[10px] text-copper break-all">{disputeId}</p>
              <p className="text-[9px] text-white/25 mt-1">
                Reference this ID in all communications with Boli.pk support.
              </p>
            </div>

            {/* Safety notice */}
            <div className="bg-copper-light border border-copper-border rounded-xl p-3 flex gap-2">
              <AlertTriangle size={12} className="text-copper mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-obs leading-relaxed">
                Do not transfer funds or devices outside the platform during dispute resolution.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
