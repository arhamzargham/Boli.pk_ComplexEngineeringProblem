import { Wallet, AlertCircle, Lock, TrendingUp } from 'lucide-react'
import { paisaToRs } from '@/lib/formatters'

interface BalanceCardProps {
  type: 'available' | 'reserved' | 'escrow' | 'total'
  paisa: number
  subtitle: string
}

const CONFIG = {
  available: {
    label: 'AVAILABLE',
    icon: Wallet,
    cardClass: 'bg-obs text-white',
    labelClass: 'text-white/40',
    amountClass: 'text-white',
    subClass: 'text-white/35',
    iconBg: 'bg-copper/20',
    iconColor: 'text-copper/80',
  },
  reserved: {
    label: 'RESERVED',
    icon: AlertCircle,
    cardClass: 'bg-surface border border-border',
    labelClass: 'text-text-faint',
    amountClass: 'text-warning',
    subClass: 'text-text-faint',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
  },
  escrow: {
    label: 'IN ESCROW',
    icon: Lock,
    cardClass: 'bg-surface border border-border',
    labelClass: 'text-text-faint',
    amountClass: 'text-text-primary',
    subClass: 'text-text-faint',
    iconBg: 'bg-obs/5',
    iconColor: 'text-text-muted',
  },
  total: {
    label: 'TOTAL DEPOSITED',
    icon: TrendingUp,
    cardClass: 'bg-cream border border-border',
    labelClass: 'text-text-faint',
    amountClass: 'text-copper',
    subClass: 'text-text-faint',
    iconBg: 'bg-copper/10',
    iconColor: 'text-copper',
  },
}

export default function BalanceCard({ type, paisa, subtitle }: BalanceCardProps) {
  const cfg = CONFIG[type]
  const Icon = cfg.icon

  return (
    <div className={`rounded-xl p-3.5 ${cfg.cardClass}`}>
      <div className={`w-7 h-7 rounded-lg ${cfg.iconBg} flex items-center justify-center mb-2.5`}>
        <Icon size={14} className={cfg.iconColor} />
      </div>
      <p className={`text-[9px] uppercase tracking-widest mb-1 ${cfg.labelClass}`}>{cfg.label}</p>
      <p className={`text-[15px] font-medium font-mono text-right ${cfg.amountClass}`}>
        {paisaToRs(paisa)}
      </p>
      <p className={`text-[9px] text-right mt-0.5 ${cfg.subClass}`}>{subtitle}</p>
    </div>
  )
}
