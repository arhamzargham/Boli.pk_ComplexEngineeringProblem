'use client'

import { useEffect, useState, type ElementType } from 'react'
import Link from 'next/link'
import { Gavel, Trophy, ShieldCheck, Info, AlertCircle, X } from 'lucide-react'
import { paisaToRs } from '@/lib/formatters'
import type { AppNotification, NotificationType } from '@/lib/notifications'

const CONFIG: Record<NotificationType, {
  icon: ElementType; iconCls: string; borderCls: string; bgCls: string
}> = {
  bid:     { icon: Gavel,       iconCls: 'text-copper',     borderCls: 'border-copper/30',    bgCls: 'bg-surface'       },
  won:     { icon: Trophy,      iconCls: 'text-success',    borderCls: 'border-success/30',   bgCls: 'bg-success/5'     },
  settled: { icon: ShieldCheck, iconCls: 'text-copper',     borderCls: 'border-copper/30',    bgCls: 'bg-copper/5'      },
  info:    { icon: Info,        iconCls: 'text-text-muted', borderCls: 'border-border',       bgCls: 'bg-surface'       },
  error:   { icon: AlertCircle, iconCls: 'text-danger',     borderCls: 'border-danger/30',    bgCls: 'bg-danger/5'      },
}

interface ToastProps {
  notification: AppNotification
  onDismiss:    (id: string) => void
}

export function Toast({ notification, onDismiss }: ToastProps) {
  const [visible,  setVisible]  = useState(false)
  const [leaving,  setLeaving]  = useState(false)
  const cfg  = CONFIG[notification.type]
  const Icon = cfg.icon

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10)
    const t2 = setTimeout(() => dismiss(), 5000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => onDismiss(notification.id), 300)
  }

  const card = (
    <div className={[
      'flex items-start gap-3 p-3.5 rounded-xl border shadow-raised max-w-[340px] w-full',
      'transition-all duration-300',
      cfg.bgCls, cfg.borderCls,
      visible && !leaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
    ].join(' ')}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bgCls}`}>
        <Icon size={15} className={cfg.iconCls} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-text-primary leading-snug">{notification.title}</p>
        <p className="text-[11px] text-text-faint mt-0.5 leading-relaxed">{notification.message}</p>
        {!!notification.amount_paisa && notification.amount_paisa > 0 && (
          <p className="text-[12px] font-mono font-medium text-copper mt-1">
            {paisaToRs(notification.amount_paisa)}
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        className="text-text-faint hover:text-text-primary flex-shrink-0 mt-0.5"
        aria-label="Dismiss notification"
      >
        <X size={13} />
      </button>
    </div>
  )

  return notification.href
    ? <Link href={notification.href} onClick={dismiss}>{card}</Link>
    : card
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts:    AppNotification[]
  onDismiss: (id: string) => void
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast notification={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}
