'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ScanLine, CameraOff, AlertTriangle, AlertCircle, ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import type { Transaction } from '@/types'

// ── Main content ──────────────────────────────────────────────────────────────
function ScanContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const txId         = searchParams.get('transaction_id') ?? ''

  const videoRef     = useRef<HTMLVideoElement>(null)
  const streamRef    = useRef<MediaStream | null>(null)

  const [transaction,  setTransaction]  = useState<Transaction | null>(null)
  const [cameraError,  setCameraError]  = useState(false)
  const [scanning,     setScanning]     = useState(false)
  const [manualToken,  setManualToken]  = useState('')
  const [verifying,    setVerifying]    = useState(false)
  const [scanError,    setScanError]    = useState<string | null>(null)

  // Fetch transaction
  useEffect(() => {
    if (!txId) return
    api.transactions.get(txId).then(setTransaction).catch(() => {})
  }, [txId])

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setScanning(true)
      } catch {
        setCameraError(true)
      }
    }
    void startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // QR code scanning with BarcodeDetector
  useEffect(() => {
    if (!scanning) return
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return

    let stopped = false
    const detector = new (window as Window & {
      BarcodeDetector: new (opts: object) => {
        detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>
      }
    }).BarcodeDetector({ formats: ['qr_code'] })

    const interval = setInterval(async () => {
      if (stopped || !videoRef.current || videoRef.current.readyState < 2) return
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes.length > 0 && codes[0].rawValue) {
          stopped = true
          clearInterval(interval)
          await handleSettle(codes[0].rawValue)
        }
      } catch { /* frame not ready */ }
    }, 400)

    return () => {
      stopped = true
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, txId])

  async function handleSettle(token: string) {
    if (!txId || !token.trim()) return
    setVerifying(true)
    setScanError(null)
    // Stop camera
    streamRef.current?.getTracks().forEach(t => t.stop())
    setScanning(false)

    try {
      await api.transactions.settle(txId, { qr_token: token.trim() })
      router.push(`/settlement?transaction_id=${txId}&status=success`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Settlement failed'
      setScanError(
        msg.toLowerCase().includes('expired') ? 'QR code expired — ask the seller to regenerate' :
        msg.toLowerCase().includes('invalid')  ? 'Invalid QR code — ensure you are scanning the seller\'s phone' :
        msg
      )
      setVerifying(false)
      // Restart camera on failure
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setScanning(true)
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-obs sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-[640px] mx-auto px-4 h-[52px] flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-white/60 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-white">Scan QR Code</p>
            <p className="text-[10px] text-white/45">
              Point camera at the seller&apos;s QR code to release escrow
            </p>
          </div>
          {transaction && <StatusBadge status={transaction.status} size="sm" />}
        </div>
      </header>

      <main className="flex-1 max-w-[640px] mx-auto w-full px-4 py-5 space-y-4">

        {/* Transaction ID */}
        {txId && (
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] text-text-faint">
              TX · {txId.slice(-12).toUpperCase()}
            </p>
            <Link href={`/transactions/${txId}`} className="text-[11px] text-copper hover:underline">
              View details
            </Link>
          </div>
        )}

        {/* ── Safety banner ── */}
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-3.5 flex gap-2.5">
          <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-text-muted leading-relaxed">
            Only scan the QR code shown on the <strong>seller&apos;s phone</strong>.
            Never scan QR codes sent via WhatsApp or SMS.
          </p>
        </div>

        {/* ── Camera viewfinder ── */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="relative bg-obs aspect-[4/3] flex items-center justify-center">
            {!cameraError ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Copper targeting reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-52 h-52">
                    {/* Corner brackets */}
                    {(['tl','tr','bl','br'] as const).map(corner => (
                      <div key={corner} className={[
                        'absolute w-8 h-8 border-copper',
                        corner === 'tl' ? 'top-0 left-0 border-t-2 border-l-2' :
                        corner === 'tr' ? 'top-0 right-0 border-t-2 border-r-2' :
                        corner === 'bl' ? 'bottom-0 left-0 border-b-2 border-l-2' :
                                          'bottom-0 right-0 border-b-2 border-r-2',
                      ].join(' ')} />
                    ))}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ScanLine size={24} className="text-copper/60" />
                    </div>
                  </div>
                </div>

                {/* Verifying overlay */}
                {verifying && (
                  <div className="absolute inset-0 bg-obs/80 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
                    <p className="text-[13px] text-white font-medium">QR detected — verifying…</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <CameraOff size={36} className="text-white/30" strokeWidth={1.2} />
                <p className="text-[12px] text-white/50">
                  Camera access denied. Use manual entry below.
                </p>
              </div>
            )}
          </div>

          <div className="p-4">
            <p className="text-[11px] text-text-faint text-center">
              {typeof window !== 'undefined' && 'BarcodeDetector' in window
                ? 'Automatically detects QR code'
                : 'Auto-detection not available — enter QR token below'}
            </p>
          </div>
        </div>

        {/* ── Error ── */}
        {scanError && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-xl px-3.5 py-3">
            <AlertCircle size={13} className="text-danger mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-danger">{scanError}</p>
          </div>
        )}

        {/* ── Manual entry fallback ── */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <p className="text-[12px] font-medium">Manual QR Token Entry</p>
          <p className="text-[11px] text-text-faint">
            If camera scanning doesn&apos;t work, ask the seller to read the token aloud.
          </p>
          <input
            type="text"
            placeholder="Paste or type QR token…"
            value={manualToken}
            onChange={e => { setManualToken(e.target.value); setScanError(null) }}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-[12px] font-mono focus:outline-none focus:border-copper bg-surface"
          />
          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={verifying}
            disabled={!manualToken.trim()}
            onClick={() => void handleSettle(manualToken)}
          >
            Verify &amp; Release Escrow
          </Button>
        </div>

        {/* ── Back link ── */}
        <div className="text-center pb-4">
          <Link
            href={txId ? `/transactions/${txId}` : '/'}
            className="text-[12px] text-copper hover:underline"
          >
            ← Back to Transaction
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function MeetupScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
      </div>
    }>
      <ScanContent />
    </Suspense>
  )
}
