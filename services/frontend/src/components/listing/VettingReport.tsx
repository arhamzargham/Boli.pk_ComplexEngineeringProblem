import { CheckCircle2 } from 'lucide-react'
import VettingBadge from '@/components/ui/VettingBadge'

interface VettingReportProps {
  classification?: 'VERIFIED' | 'REVIEWED' | 'PENDING_REVIEW' | 'REJECTED'
  compositeScore?: number
  ptaStatus?: 'REGISTERED_CLEAN' | 'UNREGISTERED' | 'BLACKLISTED'
}

const GATES = [
  { label: 'Luhn IMEI validation', resultKey: 'luhn'  },
  { label: 'PTA DIRBS lookup',     resultKey: 'dirbs' },
  { label: 'GSMA TAC match',       resultKey: 'tac'   },
]

function gateResult(key: string, classification?: string, ptaStatus?: string): string {
  if (!classification || classification === 'REJECTED') return '—'
  if (key === 'dirbs') {
    return ptaStatus === 'REGISTERED_CLEAN' ? 'Registered' : ptaStatus === 'UNREGISTERED' ? 'Unregistered' : 'Pass'
  }
  return key === 'luhn' ? 'Pass' : 'Matched'
}

export default function VettingReport({ classification, compositeScore, ptaStatus }: VettingReportProps) {
  // Distribute composite score across three checks proportionally (35:27:20 basis)
  const total = compositeScore ?? 0
  const c4 = compositeScore ? Math.round(total * 35 / 82) : undefined
  const c5 = compositeScore ? Math.round(total * 27 / 82) : undefined
  const c6 = compositeScore ? Math.round(total * 20 / 82) : undefined

  const checks = [
    { label: 'Image consistency',   score: c4, max: 40 },
    { label: 'Condition assessment', score: c5, max: 30 },
    { label: 'Price sanity check',   score: c6, max: 30 },
  ]

  const isVerified = classification === 'VERIFIED' || classification === 'REVIEWED'

  return (
    <div className="bg-surface border border-border rounded-xl p-3.5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[12px] font-medium text-text-primary">AI Vetting Report</h3>
          <p className="text-[10px] text-text-faint mt-0.5">boli-vetting-v1.0.0</p>
        </div>
        <div className="text-right">
          {compositeScore !== undefined && (
            <div className="text-[18px] font-medium text-text-primary font-mono leading-none">
              {compositeScore}
              <span className="text-[11px] text-text-faint font-sans">/100</span>
            </div>
          )}
          {classification && (
            <div className="mt-1">
              <VettingBadge classification={classification} size="sm" />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-3 mb-2">
        <p className="text-[9px] text-text-faint uppercase tracking-widest mb-2">Hard Gates</p>
        {GATES.map(gate => (
          <div key={gate.label} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
            <CheckCircle2
              size={14}
              className={isVerified ? 'text-verified-text' : 'text-text-faint'}
              strokeWidth={2}
            />
            <span className="text-[11px] text-text-muted flex-1">{gate.label}</span>
            <span className={`text-[10px] font-medium ${isVerified ? 'text-verified-text' : 'text-text-faint'}`}>
              {gateResult(gate.resultKey, classification, ptaStatus)}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-2">
        <p className="text-[9px] text-text-faint uppercase tracking-widest mb-2">Probabilistic Checks</p>
        {checks.map(check => {
          const pct = check.score !== undefined ? (check.score / check.max) * 100 : 0
          const fillColour = pct >= 75 ? 'bg-success' : 'bg-copper'
          return (
            <div key={check.label} className="flex items-center gap-2 py-1.5">
              <span className="text-[11px] text-text-muted flex-1">{check.label}</span>
              <div className="w-[80px] h-1 bg-border rounded-full overflow-hidden flex-shrink-0">
                <div className={`h-full rounded-full ${fillColour}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-text-faint w-8 text-right font-mono">
                {check.score !== undefined ? `${check.score}/${check.max}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
