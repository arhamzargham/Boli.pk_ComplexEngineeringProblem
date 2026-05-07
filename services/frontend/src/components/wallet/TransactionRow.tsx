import { ArrowDownCircle, ArrowUpCircle, Lock, MinusCircle } from 'lucide-react'
import { paisaToRs } from '@/lib/formatters'

export type TxType = 'DEPOSIT' | 'ESCROW_LOCK' | 'BID_RESERVE' | 'BID_RELEASE' | 'REFUND'

interface TransactionRowProps {
  title: string
  date: string
  amountPaisa: number
  type: TxType
  note?: string
}

const CONFIG: Record<TxType, { icon: React.ElementType; iconBg: string; iconColor: string; sign: '+' | '−'; amountColor: string }> = {
  DEPOSIT:    { icon: ArrowDownCircle, iconBg: 'bg-verified-bg', iconColor: 'text-verified-text', sign: '+', amountColor: 'text-success'      },
  BID_RELEASE:{ icon: ArrowUpCircle,  iconBg: 'bg-verified-bg', iconColor: 'text-verified-text', sign: '+', amountColor: 'text-success'      },
  REFUND:     { icon: ArrowUpCircle,  iconBg: 'bg-verified-bg', iconColor: 'text-verified-text', sign: '+', amountColor: 'text-success'      },
  ESCROW_LOCK:{ icon: Lock,           iconBg: 'bg-obs/5',        iconColor: 'text-text-muted',   sign: '−', amountColor: 'text-text-primary' },
  BID_RESERVE:{ icon: MinusCircle,    iconBg: 'bg-warning/10',   iconColor: 'text-warning',       sign: '−', amountColor: 'text-warning'      },
}

const TYPE_LABEL: Record<TxType, string> = {
  DEPOSIT:     'DEPOSIT',
  ESCROW_LOCK: 'ESCROW LOCK',
  BID_RESERVE: 'BID RESERVE',
  BID_RELEASE: 'BID RELEASE',
  REFUND:      'REFUND',
}

export default function TransactionRow({ title, date, amountPaisa, type, note }: TransactionRowProps) {
  const cfg = CONFIG[type]
  const Icon = cfg.icon

  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
        <Icon size={14} className={cfg.iconColor} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-text-primary truncate">{title}</p>
        <p className="text-[10px] text-text-faint mt-0.5">
          {date}{note && ` · ${note}`}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className={`text-[13px] font-medium font-mono ${cfg.amountColor}`}>
          {cfg.sign}{paisaToRs(amountPaisa)}
        </p>
        <p className="text-[8px] text-text-faint mt-0.5">{TYPE_LABEL[type]}</p>
      </div>
    </div>
  )
}
