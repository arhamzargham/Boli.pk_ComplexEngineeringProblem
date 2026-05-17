'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, ShieldCheck, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'
import { saveAuth } from '@/lib/auth'

const DEMO_ACCOUNTS = [
  { email: 'seller@boli.pk',  role: 'Seller'        },
  { email: 'buyer1@boli.pk',  role: 'Buyer (funded)' },
  { email: 'admin@boli.pk',   role: 'Admin'          },
]

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') ?? '/'

  const [step,     setStep]     = useState<'email' | 'otp'>('email')
  const [email,    setEmail]    = useState('')
  const [otp,      setOtp]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleRequestOtp() {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      await api.auth.requestOtp({ email: email.trim().toLowerCase() })
      setSuccess(`OTP sent to ${email}. Check your inbox.`)
      setStep('otp')
      setCooldown(60)
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
      const response = await api.auth.verifyOtp({ email: email.trim().toLowerCase(), otp_code: otp })
      saveAuth(response)
      // Also set cookie for Next.js middleware route protection
      document.cookie = `boli_token=${response.access_token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`
      if (!response.profile_complete) {
        router.push('/kyc')
      } else {
        router.push(redirectTo)
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
        <div className="w-full max-w-[420px] space-y-3">

          {/* Auth card */}
          <div className="bg-surface rounded-xl border border-border p-7 shadow-overlay">

            {/* Logo */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 rounded-xl bg-obs border border-white/10 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={18} className="text-copper" />
              </div>
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
                    onChange={e => { setEmail(e.target.value); setError(null) }}
                    onKeyDown={e => e.key === 'Enter' && void handleRequestOtp()}
                    className="flex-1 px-3 py-2.5 text-[13px] focus:outline-none bg-transparent"
                    autoComplete="email"
                    autoFocus
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
                  onClick={() => void handleRequestOtp()}
                  className="mt-3"
                >
                  Send OTP to Email
                </Button>

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

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }}
                  onKeyDown={e => e.key === 'Enter' && void handleVerifyOtp()}
                  maxLength={6}
                  autoFocus
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
                  onClick={() => void handleVerifyOtp()}
                  className="mt-3"
                >
                  Verify &amp; Login
                </Button>

                <div className="text-center mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      className="text-copper hover:underline"
                      onClick={() => { setStep('email'); setOtp(''); setError(null); setSuccess(null) }}
                    >
                      ← Change email
                    </button>
                    {cooldown > 0 ? (
                      <span className="text-text-faint font-mono">Resend in {cooldown}s</span>
                    ) : (
                      <button
                        className="text-copper hover:underline flex items-center gap-1"
                        onClick={() => { setError(null); setSuccess(null); void handleRequestOtp() }}
                      >
                        <RefreshCw size={10} />
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Demo accounts */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
              Demo accounts (click to autofill)
            </p>
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.email}
                onClick={() => { setEmail(a.email); setStep('email'); setError(null) }}
                className="w-full flex items-center justify-between py-1.5 px-2 text-left hover:bg-cream rounded-lg transition-colors"
              >
                <span className="font-mono text-[11px] text-text-primary">{a.email}</span>
                <span className="text-[10px] text-text-faint">{a.role}</span>
              </button>
            ))}
            <p className="text-[10px] text-text-faint mt-2 px-2">
              Click an account, then send OTP to that email address.
            </p>
          </div>
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-obs flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
