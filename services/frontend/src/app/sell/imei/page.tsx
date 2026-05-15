'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Camera, CameraOff, AlertCircle, CheckCircle2, ArrowLeft, Info } from 'lucide-react'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'

// ── Luhn check ────────────────────────────────────────────────────────────────
function luhnCheck(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false
  const digits = imei.split('').map(Number).reverse()
  const total = digits.reduce((sum, d, i) => {
    if (i % 2 === 1) {
      const doubled = d * 2
      return sum + (doubled > 9 ? doubled - 9 : doubled)
    }
    return sum + d
  }, 0)
  return total % 10 === 0
}

// ── Main content ──────────────────────────────────────────────────────────────
function ImeiScannerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('return') ?? '/sell/create'

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [scannedImei, setScannedImei] = useState('')
  const [manualImei, setManualImei] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean
    blacklisted: boolean
    message: string
  } | null>(null)
  const [confirmedImei, setConfirmedImei] = useState('')

  const activeImei = scannedImei || manualImei
  const imeiValid = luhnCheck(activeImei)
  const imeiDirty = activeImei.length > 0

  // Start camera
  async function startCamera() {
    setCameraError(null)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch {
      setCameraError('Camera access denied. Please allow camera permission or enter IMEI manually.')
      setCameraActive(false)
    }
  }

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Barcode scanning interval
  useEffect(() => {
    if (!cameraActive) return
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return

    let stopped = false
    const detector = new (window as Window & { BarcodeDetector: new (opts: object) => { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({
      formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
    })

    const interval = setInterval(async () => {
      if (stopped || !videoRef.current || videoRef.current.readyState < 2) return
      try {
        const barcodes = await detector.detect(videoRef.current)
        for (const bc of barcodes) {
          const candidate = bc.rawValue.replace(/\D/g, '').slice(0, 15)
          if (luhnCheck(candidate)) {
            setScannedImei(candidate)
            clearInterval(interval)
            stopped = true
            break
          }
        }
      } catch {
        // BarcodeDetector can throw if frame isn't ready
      }
    }, 500)

    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [cameraActive])

  async function handleVerify() {
    if (!imeiValid) return
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await api.vetting.checkImei(activeImei)
      setVerifyResult(res)
      if (res.valid && !res.blacklisted) {
        setConfirmedImei(activeImei)
      }
    } catch {
      setVerifyResult({ valid: imeiValid, blacklisted: false, message: 'Could not reach vetting service — IMEI format is valid' })
      if (imeiValid) setConfirmedImei(activeImei)
    } finally {
      setVerifying(false)
    }
  }

  function handleUseImei() {
    const imei = confirmedImei || (imeiValid ? activeImei : '')
    if (!imei) return
    router.push(`${returnUrl}?imei=${imei}`)
  }

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:border-copper bg-surface'

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
          <p className="text-[14px] font-medium text-white">Scan IMEI</p>
        </div>
      </header>

      <main className="flex-1 max-w-[640px] mx-auto w-full px-4 py-6 space-y-5">

        {/* ── Camera section ── */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Camera Scanner</p>
              <p className="text-[11px] text-text-faint mt-0.5">
                {typeof window !== 'undefined' && 'BarcodeDetector' in window
                  ? 'Point camera at device barcode'
                  : 'Barcode scanning not supported — use manual entry below'}
              </p>
            </div>
            {cameraActive && (
              <button
                type="button"
                onClick={() => {
                  setFacingMode(m => m === 'environment' ? 'user' : 'environment')
                  void startCamera()
                }}
                className="text-[11px] text-copper hover:underline flex items-center gap-1"
              >
                <Camera size={12} />
                Flip camera
              </button>
            )}
          </div>

          {/* Viewfinder */}
          <div className="relative bg-obs aspect-[4/3] flex items-center justify-center">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Targeting reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-32 border-2 border-copper rounded-lg relative">
                    <span className="absolute -top-5 left-0 right-0 text-[10px] text-copper text-center">
                      Align barcode with frame
                    </span>
                  </div>
                </div>
                {scannedImei && (
                  <div className="absolute bottom-3 left-3 right-3 bg-success/90 rounded-lg px-3 py-2 text-center">
                    <p className="text-[12px] font-medium text-white font-mono">
                      Scanned: {scannedImei}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                {cameraError ? (
                  <>
                    <CameraOff size={36} className="text-white/30" strokeWidth={1.2} />
                    <p className="text-[12px] text-white/50 text-center px-6">{cameraError}</p>
                  </>
                ) : (
                  <CameraOff size={36} className="text-white/30" strokeWidth={1.2} />
                )}
              </div>
            )}
          </div>

          <div className="p-4">
            {!cameraActive ? (
              <Button variant="primary" size="md" fullWidth onClick={startCamera}>
                <Camera size={14} />
                Start Camera
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  streamRef.current?.getTracks().forEach(t => t.stop())
                  setCameraActive(false)
                }}
              >
                Stop Camera
              </Button>
            )}
          </div>
        </div>

        {/* ── Manual entry section ── */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <div>
            <p className="text-[13px] font-medium mb-0.5">Manual Entry</p>
            <p className="text-[11px] text-text-faint flex items-center gap-1">
              <Info size={10} />
              Dial *#06# on your phone to display the IMEI
            </p>
          </div>

          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              maxLength={15}
              placeholder="Enter 15-digit IMEI"
              value={scannedImei || manualImei}
              onChange={e => {
                setScannedImei('')
                setManualImei(e.target.value.replace(/\D/g, '').slice(0, 15))
                setVerifyResult(null)
                setConfirmedImei('')
              }}
              className={[
                inputCls,
                'pr-8',
                imeiDirty
                  ? imeiValid ? 'border-success' : 'border-danger'
                  : '',
              ].join(' ')}
            />
            {imeiDirty && (
              <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold ${imeiValid ? 'text-success' : 'text-danger'}`}>
                {imeiValid ? '✓' : '✗'}
              </span>
            )}
          </div>

          {imeiDirty && !imeiValid && (
            <p className="text-[11px] text-danger flex items-center gap-1.5">
              <AlertCircle size={11} />
              Invalid IMEI — Luhn check failed. Please verify the number.
            </p>
          )}

          {/* Verify result */}
          {verifyResult && (
            <div className={[
              'rounded-lg px-3 py-2.5 flex items-start gap-2',
              verifyResult.blacklisted
                ? 'bg-danger/10 border border-danger/20'
                : verifyResult.valid
                  ? 'bg-success/10 border border-success/20'
                  : 'bg-danger/10 border border-danger/20',
            ].join(' ')}>
              {verifyResult.valid && !verifyResult.blacklisted
                ? <CheckCircle2 size={13} className="text-success mt-0.5 flex-shrink-0" />
                : <AlertCircle size={13} className="text-danger mt-0.5 flex-shrink-0" />
              }
              <div>
                <p className={`text-[12px] font-medium ${
                  verifyResult.blacklisted ? 'text-danger' :
                  verifyResult.valid ? 'text-success' : 'text-danger'
                }`}>
                  {verifyResult.blacklisted
                    ? 'IMEI blacklisted — cannot list this device'
                    : verifyResult.valid
                      ? 'Valid IMEI · Not blacklisted'
                      : 'Invalid IMEI — check the number'}
                </p>
                <p className="text-[10px] text-text-faint mt-0.5">{verifyResult.message}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              loading={verifying}
              disabled={!imeiValid}
              onClick={handleVerify}
            >
              Verify IMEI
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              disabled={!imeiValid || (verifyResult?.blacklisted ?? false)}
              onClick={handleUseImei}
            >
              Use this IMEI →
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ImeiPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
      </div>
    }>
      <ImeiScannerContent />
    </Suspense>
  )
}
