'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck, AlertCircle, CheckCircle2, MapPin, Clock,
  ArrowRight, AlertTriangle,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import type { Transaction } from '@/types'

const SAFETY_TIPS = [
  'Meet in a public place (mall, bank, café)',
  'Bring a witness if possible',
  'Test the device before scanning QR',
  'Never hand over device before QR is scanned',
  'Both parties must be KYC verified',
]

// ── Main content ──────────────────────────────────────────────────────────────
function CoordinateContent() {
  const searchParams = useSearchParams()
  const txId = searchParams.get('transaction_id') ?? ''

  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [date,        setDate]        = useState('')
  const [time,        setTime]        = useState('')
  const [location,    setLocation]    = useState('')
  const [notes,       setNotes]       = useState('')
  const [sending,     setSending]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [proposed,    setProposed]    = useState(false)
  const [confirmed,   setConfirmed]   = useState(false)

  const today = new Date().toISOString().split('T')[0]

  // Fetch transaction
  useEffect(() => {
    if (!txId) return
    api.transactions.get(txId).then(t => {
      setTransaction(t)
      if (t.status === 'MEETUP_CONFIRMED') setConfirmed(true)
    }).catch(() => {})
  }, [txId])

  // Poll for confirmation every 5s after proposal sent
  const poll = useCallback(async () => {
    if (!txId || confirmed) return
    try {
      const t = await api.transactions.get(txId)
      setTransaction(t)
      if (t.status === 'MEETUP_CONFIRMED') setConfirmed(true)
    } catch { /* ignore */ }
  }, [txId, confirmed])

  useEffect(() => {
    if (!proposed || confirmed) return
    const id = setInterval(() => void poll(), 5000)
    return () => clearInterval(id)
  }, [proposed, confirmed, poll])

  async function handleSendProposal() {
    if (!txId || !date || !time || !location.trim()) return
    setSending(true)
    setError(null)
    try {
      const proposedAt = new Date(`${date}T${time}`).toISOString()
      await api.transactions.confirmMeetup(txId, {
        proposed_at: proposedAt,
        location:    location.trim(),
        notes:       notes.trim(),
      })
      setProposed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send proposal')
    } finally {
      setSending(false)
    }
  }

  const canSend = !!date && !!time && !!location.trim()

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-[1280px] mx-auto px-6 py-2.5 flex items-center justify-between">
          <nav className="text-[11px]">
            <Link href="/" className="text-copper hover:underline">Home</Link>
            <span className="text-text-faint mx-1.5">›</span>
            {txId && (
              <>
                <Link href={`/transactions/${txId}`} className="text-copper hover:underline">
                  Transaction
                </Link>
                <span className="text-text-faint mx-1.5">›</span>
              </>
            )}
            <span className="text-text-muted">Coordinate Meetup</span>
          </nav>
          {transaction && <StatusBadge status={transaction.status} size="sm" />}
        </div>
      </div>

      <main className="flex-1 bg-cream py-6">
        <div className="max-w-[1280px] mx-auto px-6">

          <h1 className="font-serif text-[22px] text-text-primary mb-1">Coordinate Meetup</h1>
          {txId && (
            <p className="font-mono text-[11px] text-text-faint mb-5">
              TX · {txId.slice(-12).toUpperCase()}
            </p>
          )}

          {/* Confirmation banner */}
          {confirmed && (
            <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-start gap-3 mb-5">
              <CheckCircle2 size={18} className="text-success mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[14px] font-medium text-success">Meetup confirmed!</p>
                <p className="text-[12px] text-text-muted mt-0.5">
                  Both parties have agreed. Proceed to the meetup location.
                </p>
              </div>
              <Link
                href={`/meetup/scan?transaction_id=${txId}`}
                className="inline-flex items-center gap-1.5 bg-success text-white px-4 py-2 rounded-[9px] text-[12px] font-medium hover:bg-success/90 transition-colors flex-shrink-0"
              >
                Scan QR
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* ── LEFT — Proposal form ── */}
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <p className="text-[13px] font-medium mb-4">Propose a meetup time &amp; place</p>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-text-muted block mb-1.5">
                        Date *
                      </label>
                      <input
                        type="date"
                        min={today}
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-text-muted block mb-1.5">
                        Time *
                      </label>
                      <input
                        type="time"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-text-muted block mb-1.5">
                      <MapPin size={10} className="inline mr-1" />
                      Location *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Centaurus Mall, F-8, Islamabad"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-text-muted block mb-1.5">
                      Notes <span className="font-normal text-text-faint">(optional)</span>
                    </label>
                    <textarea
                      placeholder="e.g. Meet at the main entrance"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface resize-none"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-1.5">
                      <AlertCircle size={12} className="text-danger mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-danger">{error}</p>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={sending}
                    disabled={!canSend || proposed}
                    onClick={handleSendProposal}
                  >
                    {proposed ? 'Proposal sent' : 'Send Proposal'}
                  </Button>
                </div>
              </div>

              {/* Awaiting confirmation status */}
              {proposed && !confirmed && (
                <div className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium">Awaiting seller confirmation</p>
                      <p className="text-[11px] text-text-faint mt-0.5">
                        Polling for confirmation every 5 seconds…
                      </p>
                    </div>
                  </div>
                  {date && time && location && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {[
                        { icon: Clock,   label: 'When',  val: `${date} at ${time}` },
                        { icon: MapPin,  label: 'Where', val: location },
                      ].map(r => (
                        <div key={r.label} className="flex items-center gap-2 text-[12px]">
                          <r.icon size={12} className="text-text-faint flex-shrink-0" />
                          <span className="text-text-faint w-12">{r.label}:</span>
                          <span className="text-text-primary">{r.val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT — Safety guidelines ── */}
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={16} className="text-copper" />
                  <p className="text-[13px] font-medium">Meetup Safety</p>
                </div>
                <ul className="space-y-2.5">
                  {SAFETY_TIPS.map(tip => (
                    <li key={tip} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-copper mt-1.5 flex-shrink-0" />
                      <span className="text-[12px] text-text-muted">{tip}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                  <ShieldCheck size={13} className="text-copper flex-shrink-0" />
                  <p className="text-[11px] text-text-muted">
                    Boli.pk escrow protects both parties
                  </p>
                </div>
              </div>

              {/* Late night warning */}
              <div className="bg-warning/5 border border-warning/20 rounded-xl p-3.5 flex gap-2.5">
                <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Avoid meetups between 10 PM and 6 AM. Choose busy public spaces
                  during daylight hours for your safety.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function MeetupCoordinatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-copper border-t-transparent animate-spin" />
      </div>
    }>
      <CoordinateContent />
    </Suspense>
  )
}
