'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { QrCode, ScanLine, ShieldCheck } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import StatusBadge from '@/components/ui/StatusBadge'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'
import type { Transaction } from '@/types'

function MeetupContent() {
  const searchParams = useSearchParams()
  const txId = searchParams.get('transaction_id') ?? ''

  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [qrData, setQrData]           = useState<string | null>(null)
  const [qrExpiry, setQrExpiry]       = useState<string | null>(null)
  const [generating, setGenerating]   = useState(false)
  const [qrError, setQrError]         = useState<string | null>(null)

  useEffect(() => {
    if (!txId) return
    api.transactions.get(txId).then(setTransaction).catch(() => {})
  }, [txId])

  async function handleGenerateQr() {
    if (!txId) return
    setGenerating(true)
    setQrError(null)
    try {
      const res = await api.transactions.generateQr(txId)
      setQrData(res.qr_data)
      setQrExpiry(res.expires_at)
    } catch (e) {
      setQrError(e instanceof Error ? e.message : 'Failed to generate QR code')
    } finally {
      setGenerating(false)
    }
  }

  if (!txId) {
    return (
      <main className="flex-1 bg-cream flex items-center justify-center">
        <p className="text-[14px] text-text-muted">No transaction ID provided.</p>
      </main>
    )
  }

  return (
    <main className="flex-1 bg-cream">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-6">

        {/* Header */}
        <div className="mb-6">
          <p className="text-[10px] text-text-faint uppercase tracking-widest mb-1">Meetup Settlement</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-[22px] text-text-primary">QR Settlement</h1>
            {transaction && <StatusBadge status={transaction.status} size="md" />}
          </div>
          <p className="font-mono text-[12px] text-text-faint mt-1 break-all">{txId}</p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* LEFT — Generate QR */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-copper/10 flex items-center justify-center">
                <QrCode size={16} className="text-copper" />
              </div>
              <h2 className="text-[13px] font-medium">Generate QR Code</h2>
            </div>

            <p className="text-[12px] text-text-faint mb-4 leading-relaxed">
              As the seller, generate a one-time QR code for this transaction. The buyer scans it
              at the physical meetup to release escrow funds.
            </p>

            {qrError && (
              <div className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-[11px] text-danger mb-3">
                {qrError}
              </div>
            )}

            {qrData ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrData.startsWith('data:') ? qrData : `data:image/png;base64,${qrData}`}
                  alt="Settlement QR code"
                  className="w-48 h-48 border border-border rounded-lg"
                />
                {qrExpiry && (
                  <p className="text-[10px] text-text-faint">
                    Expires: <span className="font-mono">{qrExpiry}</span>
                  </p>
                )}
                <Button variant="secondary" size="md" onClick={handleGenerateQr} loading={generating}>
                  Regenerate
                </Button>
              </div>
            ) : (
              <Button variant="primary" size="md" fullWidth loading={generating} onClick={handleGenerateQr}>
                Generate QR Code
              </Button>
            )}
          </div>

          {/* RIGHT — Scan instructions */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-copper/10 flex items-center justify-center">
                <ScanLine size={16} className="text-copper" />
              </div>
              <h2 className="text-[13px] font-medium">Scan to Confirm</h2>
            </div>

            <div className="space-y-3 text-[12px] text-text-muted leading-relaxed">
              <p>
                At the physical meetup, the <strong className="text-text-primary">buyer</strong> must:
              </p>
              <ol className="space-y-2 list-decimal list-inside">
                <li>Open the Boli.pk app and go to this transaction.</li>
                <li>Scan the QR code displayed on the seller&apos;s phone.</li>
                <li>Verify the device IMEI matches the listing.</li>
                <li>Confirm — escrow funds release instantly.</li>
              </ol>
              <div className="bg-copper-light border border-copper-border rounded-lg p-3 flex gap-2.5 mt-4">
                <ShieldCheck size={14} className="text-copper mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-obs leading-relaxed">
                  The QR code is one-time use and expires 4 hours after the confirmed meetup time.
                  Do not share the QR code before the physical meetup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function MeetupPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <Suspense
        fallback={
          <main className="flex-1 bg-cream flex items-center justify-center">
            <div className="w-full max-w-[480px] px-4 space-y-3">
              <div className="h-[200px] rounded-xl bg-border animate-pulse" />
              <div className="h-[200px] rounded-xl bg-border animate-pulse" />
            </div>
          </main>
        }
      >
        <MeetupContent />
      </Suspense>
      <StatsBar />
      <Footer />
    </div>
  )
}
