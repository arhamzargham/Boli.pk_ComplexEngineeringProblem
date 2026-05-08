'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'
import { paisaToRs } from '@/lib/formatters'

const QUICK_FILL = [
  { label: 'Seed buyer',  id: 'b0000000-0000-4000-8000-000000000001' },
  { label: 'Seed seller', id: 'c0000000-0000-4000-8000-000000000001' },
  { label: 'Seed admin',  id: 'a0000000-0000-4000-8000-000000000001' },
]

export default function AdminWalletsPage() {
  const [userId,    setUserId]    = useState('')
  const [amountRs,  setAmountRs]  = useState('')
  const [note,      setNote]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)

  const amountPaisa = parseInt(amountRs, 10) * 100 || 0

  async function handleFund() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await api.admin.fundWallet(userId.trim(), amountPaisa, note.trim() || 'Admin fund')
      setSuccess(`Funded ${paisaToRs(amountPaisa)} to wallet ${res.wallet_id}`)
      setUserId('')
      setAmountRs('')
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fund wallet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-5">
      <h1 className="font-serif text-[22px] mb-1">Fund Wallet</h1>
      <p className="text-[12px] text-text-muted mb-5">
        Admin-only operation. Adds funds to a user wallet.
        All operations are logged and auditable.
      </p>

      <div className="bg-surface border border-border rounded-xl p-5 max-w-[440px] space-y-4">

        {/* User ID */}
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">
            User ID
          </label>
          <input
            type="text"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="b0000000-0000-4000-8000-000000000001"
            className="w-full text-[12px] font-mono border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-copper"
          />
          <div className="flex gap-1.5 mt-1">
            {QUICK_FILL.map(q => (
              <button
                key={q.id}
                onClick={() => setUserId(q.id)}
                className="text-[10px] text-text-muted border border-border rounded px-2 py-0.5 hover:bg-cream transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">
            Amount (Rs.)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={amountRs}
            onChange={e => setAmountRs(e.target.value.replace(/\D/g, ''))}
            placeholder="500000"
            className="w-full text-[12px] font-mono border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-copper"
          />
          {amountPaisa > 0 && (
            <p className="text-[11px] text-text-faint mt-1">= {paisaToRs(amountPaisa)}</p>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">
            Note
          </label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="CEP test fund — admin"
            className="w-full text-[12px] border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-copper"
          />
        </div>

        {/* Feedback */}
        {error && (
          <div className="flex items-center gap-1.5 text-danger">
            <AlertCircle size={12} />
            <span className="text-[11px]">{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-success">
            <CheckCircle2 size={12} />
            <span className="text-[11px]">{success}</span>
          </div>
        )}

        <Button
          variant="primary"
          size="md"
          fullWidth
          loading={loading}
          disabled={!userId.trim() || amountPaisa <= 0}
          onClick={handleFund}
        >
          Fund Wallet
        </Button>
      </div>

      {/* Warning */}
      <div className="mt-4 max-w-[440px] bg-danger/5 border border-danger/15 rounded-lg p-3 flex gap-2">
        <AlertTriangle size={13} className="text-danger/70 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-text-muted leading-relaxed">
          This operation immediately modifies wallet balances. There is no undo.
          Only use with seed user IDs during testing.
        </p>
      </div>
    </div>
  )
}
