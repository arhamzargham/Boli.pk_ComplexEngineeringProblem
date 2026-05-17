'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, AlertTriangle, CheckCircle, Mail } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'
import { getToken, getAuth, userInitials, logout } from '@/lib/auth'
import { api } from '@/lib/api'

interface UserProfile {
  user_id: string
  email: string
  phone: string
  kyc_tier: string
  account_status: string
  trust_score: number
  role: string
  created_at: string
}

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/login'); return }

    api.user.profile()
      .then(setProfile)
      .catch(() => {
        const auth = getAuth()
        if (auth) {
          setProfile({
            user_id:        auth.userId ?? '',
            email:          '',
            phone:          '',
            kyc_tier:       auth.kycTier ?? 'BASIC',
            account_status: 'FULL_ACTIVE',
            trust_score:    50,
            role:           auth.role ?? 'BUYER',
            created_at:     '',
          })
        } else {
          setFetchError('Failed to load profile. Please log in again.')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const initials = profile ? userInitials(profile.user_id) : '?'

  const kycColor = (tier: string) =>
    tier === 'FULL' ? 'text-success' : 'text-copper'

  const trustColor = (score: number) => {
    if (score >= 75) return 'text-success'
    if (score >= 50) return 'text-copper'
    return 'text-danger'
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 bg-cream flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
        </div>
        <Footer />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 bg-cream flex items-center justify-center px-4">
          <div className="flex items-center gap-3 text-danger">
            <AlertTriangle size={18} />
            <span className="text-[13px]">{fetchError}</span>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-2.5">
          <nav className="text-[11px]">
            <Link href="/" className="text-copper hover:underline">Home</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <span className="text-text-muted">My Account</span>
          </nav>
        </div>
      </div>

      <main className="flex-1 bg-cream">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

          {/* Page header */}
          <div>
            <h1 className="font-serif text-[22px] text-text-primary">My Account</h1>
            <p className="text-[11px] text-text-faint mt-0.5">
              Manage your profile, security and KYC status
            </p>
          </div>

          {/* Profile card */}
          <section className="bg-surface border border-border rounded-xl p-5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-text-faint mb-4">
              Profile
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-copper/15 border border-copper/30
                              flex items-center justify-center text-copper text-lg
                              font-bold shrink-0">
                {initials}
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-[14px] font-medium text-text-primary truncate">
                  {profile.email || 'No email set'}
                </p>
                <p className="text-[12px] text-text-muted">
                  {profile.phone || 'No phone on file'}
                </p>
                <p className="text-[11px] text-text-faint">
                  {profile.created_at
                    ? `Member since ${new Date(profile.created_at).toLocaleDateString('en-PK', {
                        year: 'numeric', month: 'long',
                      })}`
                    : 'Member'}
                </p>
              </div>
            </div>
          </section>

          {/* KYC Status */}
          <section className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={13} className="text-text-faint" />
              <p className="text-[10px] font-medium uppercase tracking-widest text-text-faint">
                KYC Status
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-cream rounded-lg p-3">
                <p className="text-[10px] text-text-faint mb-1">Tier</p>
                <p className={`text-[17px] font-bold ${kycColor(profile.kyc_tier)}`}>
                  {profile.kyc_tier}
                </p>
              </div>
              <div className="bg-cream rounded-lg p-3">
                <p className="text-[10px] text-text-faint mb-1">Trust Score</p>
                <p className={`text-[17px] font-bold ${trustColor(profile.trust_score)}`}>
                  {profile.trust_score}/100
                </p>
              </div>
              <div className="bg-cream rounded-lg p-3">
                <p className="text-[10px] text-text-faint mb-1">Status</p>
                <p className="text-[12px] font-semibold text-text-primary">
                  {profile.account_status.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            {profile.kyc_tier !== 'FULL' && (
              <Link
                href="/kyc"
                className="inline-flex items-center gap-1.5 text-[12px] text-copper
                           hover:underline transition-colors"
              >
                <CheckCircle size={13} />
                Upgrade to KYC FULL for higher escrow limits →
              </Link>
            )}
          </section>

          {/* Sign-in method */}
          <section className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mail size={13} className="text-text-faint" />
              <p className="text-[10px] font-medium uppercase tracking-widest text-text-faint">
                Sign-in Method
              </p>
            </div>
            <p className="text-[13px] text-text-muted">
              You sign in with a one-time code sent to your email. No password is stored.
            </p>
            <p className="text-[11px] text-text-faint mt-1">
              To change your email address, contact support.
            </p>
          </section>

          {/* Danger zone */}
          <section className="bg-surface border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={13} className="text-danger" />
              <p className="text-[10px] font-medium uppercase tracking-widest text-danger/70">
                Danger Zone
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] text-text-primary font-medium">
                  Sign out of all devices
                </p>
                <p className="text-[11px] text-text-faint mt-0.5">
                  Revokes all active sessions and tokens
                </p>
              </div>
              <button
                onClick={() => logout()}
                className="px-4 py-2 rounded-[9px] border border-red-300 text-danger
                           text-[12px] font-medium hover:bg-red-50 transition-colors shrink-0"
              >
                Sign Out
              </button>
            </div>
          </section>

        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}
