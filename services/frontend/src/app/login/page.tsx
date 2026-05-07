'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, AlertCircle } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'
import { saveAuth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep]         = useState<1 | 2>(1)
  const [phone, setPhone]       = useState('')
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first OTP box when step 2 opens
  useEffect(() => {
    if (step === 2) otpRefs.current[0]?.focus()
  }, [step])

  const otp = otpValues.join('')

  async function handleRequestOtp() {
    if (!phone.trim()) return
    const fullPhone = `+92${phone.replace(/\D/g, '')}`
    setError(null)
    setLoading(true)
    try {
      await api.auth.requestOtp(fullPhone)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) return
    const fullPhone = `+92${phone.replace(/\D/g, '')}`
    setError(null)
    setLoading(true)
    try {
      const response = await api.auth.verifyOtp(fullPhone, otp)
      saveAuth(response)
      router.push('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incorrect OTP')
      // Clear boxes on error
      setOtpValues(Array(6).fill(''))
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  function handleOtpInput(index: number, value: string) {
    const char = value.slice(-1)
    if (char && !/\d/.test(char)) return
    const next = [...otpValues]
    next[index] = char
    setOtpValues(next)
    if (char && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = Array(6).fill('')
    pasted.split('').forEach((c, i) => { next[i] = c })
    setOtpValues(next)
    const focusIdx = Math.min(pasted.length, 5)
    otpRefs.current[focusIdx]?.focus()
  }

  const maskedPhone = phone ? `+92 300 ···${phone.slice(-4)}` : ''

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar variant="minimal" />

      <main className="flex-1 bg-obs flex items-center justify-center px-4 py-8">
        <div className="bg-surface rounded-xl border border-border p-7 w-full max-w-[380px] shadow-overlay">

          {/* Logo */}
          <div className="text-center mb-4">
            <span className="font-serif text-[22px] text-obs">Boli.pk</span>
            <p className="text-[11px] text-text-faint italic mt-0.5">Boli tumhari. Guarantee hamari.</p>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1.5 mb-5">
            <div className={`h-1 flex-1 rounded-sm ${step >= 1 ? 'bg-copper' : 'bg-border'}`} />
            <div className={`h-1 flex-1 rounded-sm ${step >= 2 ? 'bg-copper' : 'bg-border'}`} />
          </div>

          {/* STEP 1 — phone */}
          {step === 1 && (
            <div>
              <p className="text-[10px] text-text-faint uppercase tracking-wider mb-1">
                Step 1 of 2 — Mobile number
              </p>
              <label className="text-[11px] font-medium text-text-muted block mb-1.5 mt-3">
                Mobile number
              </label>
              <div className="flex border border-border rounded-lg overflow-hidden focus-within:border-copper focus-within:ring-1 focus-within:ring-copper transition-colors">
                <div className="bg-cream px-3 flex items-center border-r border-border flex-shrink-0">
                  <span className="text-[12px] text-text-muted">🇵🇰 +92</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="300 0000003"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                  className="flex-1 px-3 py-2.5 text-[13px] focus:outline-none bg-transparent"
                />
              </div>
              <p className="text-[10px] text-text-faint mt-1">
                We will send a 6-digit OTP. Standard SMS rates apply.
              </p>

              {error && (
                <div className="flex items-center gap-1.5 mt-2 text-danger">
                  <AlertCircle size={11} />
                  <span className="text-[11px]">{error}</span>
                </div>
              )}

              <Button
                variant="primary"
                size="md"
                fullWidth
                loading={loading}
                onClick={handleRequestOtp}
                className="mt-3"
              >
                Send OTP
              </Button>

              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-[10px] text-text-faint">or</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <Button variant="secondary" size="md" fullWidth>
                Continue as guest · Browse only
              </Button>

              {/* Trust note */}
              <div className="bg-cream rounded-lg p-2.5 mt-3 flex gap-2 items-start">
                <ShieldCheck size={12} className="text-copper mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Your number is never sold or shared. CNIC required to bid or list.
                  Penalty policy acknowledged at KYC step.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2 — OTP */}
          {step === 2 && (
            <div>
              <p className="text-[10px] text-text-faint uppercase tracking-wider mb-1">
                Step 2 of 2 — OTP verification
              </p>
              <h2 className="text-[13px] font-medium text-center mt-3">Enter the 6-digit code</h2>
              <p className="text-[11px] text-text-faint text-center mt-1">
                Sent to {maskedPhone} · Expires in 4:52
              </p>

              {/* OTP boxes */}
              <div className="flex gap-2 justify-center mt-4" onPaste={handleOtpPaste}>
                {otpValues.map((val, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={val}
                    onChange={e => handleOtpInput(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={[
                      'w-[42px] h-[48px] text-center text-[18px] font-medium rounded-lg bg-cream',
                      'focus:outline-none transition-colors',
                      val ? 'border-2 border-copper' : 'border border-border',
                      'focus:border-2 focus:border-copper',
                    ].join(' ')}
                  />
                ))}
              </div>

              {/* Inline error — never alert() */}
              {error && (
                <div className="flex items-center gap-1.5 justify-center mt-2">
                  <AlertCircle size={11} className="text-danger" />
                  <span className="text-[11px] text-danger">{error}</span>
                </div>
              )}

              <Button
                variant="primary"
                size="md"
                fullWidth
                loading={loading}
                disabled={otp.length < 6}
                onClick={handleVerifyOtp}
                className="mt-3"
              >
                Verify &amp; Login
              </Button>

              <div className="text-center mt-3 space-y-1.5">
                <p className="text-[11px] text-text-faint">
                  Didn&apos;t receive it?{' '}
                  <button
                    className="text-copper hover:underline"
                    onClick={() => { setError(null); handleRequestOtp() }}
                  >
                    Resend OTP
                  </button>
                </p>
                <button
                  className="text-[11px] text-copper hover:underline block w-full"
                  onClick={() => { setStep(1); setError(null); setOtpValues(Array(6).fill('')) }}
                >
                  ← Change number
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}
