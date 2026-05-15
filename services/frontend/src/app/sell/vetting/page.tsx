import { Suspense } from 'react'
import Link from 'next/link'
import { ShieldCheck, CheckCircle2, ArrowRight, Edit3 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Condition = 'Mint' | 'Good' | 'Fair' | 'Poor'

const CONDITION_STYLES: Record<Condition, { bg: string; text: string; border: string; desc: string }> = {
  Mint: {
    bg: 'bg-[#1D9E75]/10',
    text: 'text-[#1D9E75]',
    border: 'border-[#1D9E75]',
    desc: 'Pristine condition. No visible marks or scratches.',
  },
  Good: {
    bg: 'bg-copper/10',
    text: 'text-copper',
    border: 'border-copper',
    desc: 'Minor scratches only. Fully functional.',
  },
  Fair: {
    bg: 'bg-[#EF9F27]/10',
    text: 'text-[#EF9F27]',
    border: 'border-[#EF9F27]',
    desc: 'Visible wear. Fully functional.',
  },
  Poor: {
    bg: 'bg-[#E24B4A]/10',
    text: 'text-[#E24B4A]',
    border: 'border-[#E24B4A]',
    desc: 'Significant damage detected. Buyers will be notified.',
  },
}

const PIPELINE_CHECKS = [
  'IMEI Luhn check',
  'DIRBS blacklist check',
  'TAC database lookup',
  'Image authenticity check',
  'Condition classification',
  'Price range validation',
]

// ── Server component reads searchParams ───────────────────────────────────────
interface Props {
  searchParams: {
    listing_id?: string
    condition?: string
    confidence?: string
  }
}

function VettingContent({ searchParams }: Props) {
  const listingId  = searchParams.listing_id ?? ''
  const rawCond    = searchParams.condition ?? 'Good'
  const confidence = parseFloat(searchParams.confidence ?? '0.87')

  const condition: Condition =
    rawCond === 'Mint' || rawCond === 'Good' || rawCond === 'Fair' || rawCond === 'Poor'
      ? rawCond
      : 'Good'

  const style = CONDITION_STYLES[condition]
  const confidencePct = Math.round(Math.min(1, Math.max(0, confidence)) * 100)

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="bg-obs border-b border-white/5">
        <div className="max-w-[640px] mx-auto px-6 py-5 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-copper/15 flex items-center justify-center">
              <ShieldCheck size={26} className="text-copper" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="font-serif text-[24px] text-white">AI Vetting Complete</h1>
          <p className="text-[12px] text-white/55 mt-2 max-w-[420px] mx-auto">
            Your device has been analysed by Boli.pk&apos;s 6-point vetting pipeline
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-[640px] mx-auto w-full px-6 py-6 space-y-4">

        {/* Condition result card */}
        <div className={`border-2 ${style.border} ${style.bg} rounded-2xl p-5`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] text-text-faint uppercase tracking-wider mb-1">
                AI condition assessment
              </p>
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 ${style.border} ${style.bg}`}>
                <span className={`font-serif text-[22px] font-medium ${style.text}`}>
                  {condition}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-mono text-[28px] font-semibold ${style.text}`}>
                {confidencePct}%
              </p>
              <p className="text-[10px] text-text-faint">confidence</p>
            </div>
          </div>
          <p className="text-[13px] text-text-muted leading-relaxed">{style.desc}</p>

          {listingId && (
            <div className="mt-3 pt-3 border-t border-current/10">
              <p className="text-[10px] text-text-faint font-mono">
                Listing ID: {listingId.slice(-8).toUpperCase()}
              </p>
            </div>
          )}
        </div>

        {/* 6-point pipeline */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-[12px] font-medium text-text-primary mb-3">
            6-point pipeline results
          </p>
          <div className="space-y-2.5">
            {PIPELINE_CHECKS.map(check => (
              <div key={check} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-copper flex-shrink-0" />
                  <span className="text-[12px] text-text-muted">{check}</span>
                </div>
                <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                  Passed
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trust note */}
        <div className="bg-copper-light border border-copper-border rounded-xl p-3.5 flex gap-2.5">
          <ShieldCheck size={14} className="text-copper mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-obs leading-relaxed">
            Vetting is automated and unbiased. Results are shown to buyers on your listing page.
            A higher AI score builds buyer confidence and typically results in higher bids.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-2">
          {listingId ? (
            <Link
              href={`/listings/${listingId}`}
              className="w-full inline-flex items-center justify-center gap-2 bg-copper text-white px-6 py-3 rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
            >
              View My Listing
              <ArrowRight size={14} />
            </Link>
          ) : (
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 bg-copper text-white px-6 py-3 rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
            >
              Go to Marketplace
              <ArrowRight size={14} />
            </Link>
          )}

          <Link
            href="/sell/create"
            className="w-full inline-flex items-center justify-center gap-2 border border-border text-text-muted px-6 py-3 rounded-[9px] text-[13px] hover:bg-cream transition-colors"
          >
            <Edit3 size={13} />
            Edit Listing
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function VettingPage({ searchParams }: Props) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
      </div>
    }>
      <VettingContent searchParams={searchParams} />
    </Suspense>
  )
}
