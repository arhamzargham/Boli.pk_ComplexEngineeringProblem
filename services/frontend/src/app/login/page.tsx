'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'
import { saveAuth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep]       = useState<'email' | 'otp'>('email')
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleRequestOtp() {
    if (!email.trim()) return
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      await api.auth.requestOtp({ email: email.trim() })
      setSuccess(`OTP sent to ${email}. Check your inbox.`)
      setStep('otp')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) return
    setError(null)
    setLoading(true)
    try {
      const response = await api.auth.verifyOtp({ email: email.trim(), otp_code: otp })
      saveAuth(response)
      // Redirect: incomplete profile → KYC, complete profile → home
      if (!response.profile_complete) {
        router.push('/kyc')
      } else {
        router.push('/')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP — please try again')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

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
            <div className="h-1 flex-1 rounded-sm bg-copper" />
            <div className={`h-1 flex-1 rounded-sm ${step === 'otp' ? 'bg-copper' : 'bg-border'}`} />
          </div>

          {/* ── STEP 1 — Email ── */}
          {step === 'email' && (
            <div>
              <p className="text-[10px] text-text-faint uppercase tracking-wider mb-1">
                Step 1 of 2 — Email address
              </p>

              <label className="text-[11px] font-medium text-text-muted block mb-1.5 mt-3">
                Email address
              </label>
              <div className="flex border border-border rounded-lg overflow-hidden focus-within:border-copper focus-within:ring-1 focus-within:ring-copper transition-colors">
                <div className="bg-cream px-3 flex items-center border-r border-border flex-shrink-0">
                  <Mail size={13} className="text-text-faint" />
                </div>
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                  className="flex-1 px-3 py-2.5 text-[13px] focus:outline-none bg-transparent"
                  autoComplete="email"
                />
              </div>
              <p className="text-[10px] text-text-faint mt-1">
                We will email a 6-digit one-time code. No password needed.
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
                Send OTP to Email
              </Button>

              {/* Trust note */}
              <div className="bg-cream rounded-lg p-2.5 mt-3 flex gap-2 items-start">
                <ShieldCheck size={12} className="text-copper mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Your email is never shared. CNIC required to bid or list.
                  Panel members can register with their institutional email.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 2 — OTP ── */}
          {step === 'otp' && (
            <div>
              <p className="text-[10px] text-text-faint uppercase tracking-wider mb-1">
                Step 2 of 2 — Email verification
              </p>

              {success && (
                <div className="flex items-start gap-1.5 mt-2 mb-3 bg-success/10 border border-success/20 rounded-lg px-3 py-2">
                  <CheckCircle2 size={11} className="text-success mt-0.5 flex-shrink-0" />
                  <span className="text-[11px] text-success">{success}</span>
                </div>
              )}

              <h2 className="text-[13px] font-medium text-center mt-1">Enter the 6-digit code</h2>
              <p className="text-[11px] text-text-faint text-center mt-1 mb-4">
                Sent to <span className="font-medium text-text-primary">{email}</span>
              </p>

              {/* Single OTP input — easier than 6 boxes for email flow */}
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                maxLength={6}
                className="w-full border border-border rounded-lg px-4 py-3 text-[20px] text-center font-mono tracking-[0.4em] focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper transition-colors"
                autoComplete="one-time-code"
              />

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
                    onClick={() => { setError(null); setSuccess(null); handleRequestOtp() }}
                  >
                    Resend OTP
                  </button>
                </p>
                <button
                  className="text-[11px] text-copper hover:underline block w-full"
                  onClick={() => { setStep('email'); setOtp(''); setError(null); setSuccess(null) }}
                >
                  ← Change email
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
