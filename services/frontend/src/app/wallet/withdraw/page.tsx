'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Info, ArrowRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'
import { paisaToRs } from '@/lib/formatters'
import { isAuthenticated } from '@/lib/auth'
import type { Wallet } from '@/types'

const BANKS = [
  'HBL', 'MCB', 'UBL', 'Meezan Bank', 'Allied Bank',
  'Bank Alfalah', 'Askari Bank', 'Faysal Bank', 'Standard Chartered', 'Other',
]

const PROCESSING_FEE_PAISA = 2500

function isValidIban(iban: string): boolean {
  return /^PK[A-Z0-9]{22}$/.test(iban) && iban.length === 24
}

export default function WithdrawPage() {
  const router = useRouter()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)

  const [amountPkr, setAmountPkr] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [iban, setIban] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ reference_id: string; amount_paisa: number } | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    api.wallet.get()
      .then(setWallet)
      .catch(() => {})
      .finally(() => setWalletLoading(false))
  }, [router])

  const availablePaisa = wallet?.available_paisa ?? 0
  const amountPaisa = Math.floor(Number(amountPkr) * 100)
  const receivePaisa = amountPaisa > PROCESSING_FEE_PAISA ? amountPaisa - PROCESSING_FEE_PAISA : 0
  const ibanValid = isValidIban(iban)

  const canSubmit =
    amountPaisa >= 50_000 &&
    amountPaisa <= availablePaisa &&
    bankName !== '' &&
    accountTitle.trim() !== '' &&
    ibanValid &&
    !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await api.wallet.withdraw({
        amount_paisa: amountPaisa,
        bank_name: bankName,
        account_title: accountTitle.trim(),
        iban,
      })
      setSuccess({ reference_id: result.reference_id, amount_paisa: amountPaisa })
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Withdrawal request failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col min-h-screen bg-cream">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-[480px] w-full bg-surface border border-border rounded-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} className="text-success" strokeWidth={1.5} />
          </div>
          <h1 className="font-serif text-[24px] text-text-primary">Withdrawal Requested</h1>
          <p className="font-mono text-[11px] text-text-faint">
            REF: {success.reference_id.slice(-12).toUpperCase()}
          </p>
          <p className="text-[20px] font-medium font-mono text-copper">
            {paisaToRs(success.amount_paisa)}
          </p>
          <p className="text-[12px] text-text-faint">Expected transfer: 1–2 business days</p>
          <Link
            href="/wallet"
            className="inline-flex items-center justify-center w-full gap-2 bg-copper text-white px-6 py-3 rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
          >
            Back to Wallet
          </Link>
        </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-[640px] mx-auto px-4 py-2.5 flex items-center justify-between">
          <nav className="text-[11px]">
            <Link href="/" className="text-copper hover:underline">Home</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <Link href="/wallet" className="text-copper hover:underline">Wallet</Link>
            <span className="text-text-faint mx-1.5">›</span>
            <span className="text-text-muted">Withdraw</span>
          </nav>
          {!walletLoading && wallet && (
            <p className="text-[11px] text-text-faint">
              Avail: <span className="text-copper font-mono">{paisaToRs(availablePaisa)}</span>
            </p>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-[640px] mx-auto w-full px-4 py-5 space-y-4">

        {/* Amount */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <p className="text-[13px] font-medium">Withdrawal amount</p>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-faint font-mono select-none">
              Rs.
            </span>
            <input
              type="number"
              min={500}
              step={1}
              placeholder="0"
              value={amountPkr}
              onChange={e => setAmountPkr(e.target.value)}
              className="w-full border border-border rounded-lg pl-10 pr-28 py-2.5 text-[14px] font-mono focus:outline-none focus:border-copper bg-surface"
            />
            <button
              type="button"
              onClick={() => setAmountPkr(String(Math.floor(availablePaisa / 100)))}
              disabled={walletLoading || availablePaisa === 0}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-copper hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Withdraw All
            </button>
          </div>

          {amountPkr && (
            <p className="text-[10px] text-text-faint font-mono">
              = {amountPaisa.toLocaleString('en-US')} paisa
            </p>
          )}

          {amountPaisa > 0 && amountPaisa < 50_000 && (
            <p className="text-[11px] text-danger">Minimum withdrawal is Rs. 500</p>
          )}
          {wallet && amountPaisa > availablePaisa && (
            <p className="text-[11px] text-danger">
              Exceeds available balance ({paisaToRs(availablePaisa)})
            </p>
          )}
        </div>

        {/* Bank details */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <p className="text-[13px] font-medium">Bank account details</p>

          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1.5">Bank name *</label>
            <select
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface"
            >
              <option value="">Select bank…</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1.5">Account title *</label>
            <input
              type="text"
              placeholder="Muhammad Ali"
              value={accountTitle}
              onChange={e => setAccountTitle(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1.5">IBAN *</label>
            <input
              type="text"
              placeholder="PK36SCBL0000001123456702"
              value={iban}
              onChange={e => setIban(e.target.value.toUpperCase())}
              maxLength={24}
              className={[
                'w-full border rounded-lg px-3 py-2.5 text-[13px] font-mono focus:outline-none bg-surface',
                iban.length > 0
                  ? ibanValid ? 'border-success' : 'border-danger'
                  : 'border-border focus:border-copper',
              ].join(' ')}
            />
            {iban.length > 0 && !ibanValid && (
              <p className="text-[10px] text-danger mt-1">
                Must start with PK followed by 22 alphanumeric characters (24 total)
              </p>
            )}
            <p className="text-[10px] text-text-faint mt-1">
              Funds will be transferred within 1–2 business days
            </p>
          </div>
        </div>

        {/* Fee summary */}
        {amountPaisa > 0 && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-[12px] font-medium mb-3">Fee summary</p>
            <div className="space-y-2">
              {[
                { label: 'Withdrawal amount', value: paisaToRs(amountPaisa),              cls: '' },
                { label: 'Processing fee',    value: `− ${paisaToRs(PROCESSING_FEE_PAISA)}`, cls: 'text-warning' },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-[12px]">
                  <span className="text-text-faint">{r.label}</span>
                  <span className={`font-mono ${r.cls}`}>{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between text-[13px] font-medium pt-2 border-t border-border">
                <span>You will receive</span>
                <span className="font-mono text-success">{paisaToRs(receivePaisa)}</span>
              </div>
            </div>
          </div>
        )}

        {/* WHT notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex gap-2.5">
          <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-blue-700 leading-relaxed">
            Withholding tax (WHT) may be deducted by your bank as per FBR regulations.
          </p>
        </div>

        {/* Error */}
        {submitError && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl px-3.5 py-3">
            <p className="text-[12px] text-danger">{submitError}</p>
          </div>
        )}

        {/* Submit */}
        <div className="pb-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            Request Withdrawal
            <ArrowRight size={14} />
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
