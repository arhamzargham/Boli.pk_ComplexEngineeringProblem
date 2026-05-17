'use client'

import { useEffect, type ElementType } from 'react'
import Link from 'next/link'
import {
  Bell, Gavel, Trophy, ShieldCheck, Info, AlertCircle, Trash2, CheckCheck,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useNotifications } from '@/lib/notifications'
import { paisaToRs } from '@/lib/formatters'
import type { NotificationType } from '@/lib/notifications'

const TYPE_CONFIG: Record<NotificationType, { icon: ElementType; iconCls: string; label: string }> = {
  bid:     { icon: Gavel,       iconCls: 'text-copper',     label: 'New bid'     },
  won:     { icon: Trophy,      iconCls: 'text-success',    label: 'Auction won' },
  settled: { icon: ShieldCheck, iconCls: 'text-copper',     label: 'Settlement'  },
  info:    { icon: Info,        iconCls: 'text-text-muted', label: 'Info'        },
  error:   { icon: AlertCircle, iconCls: 'text-danger',     label: 'Error'       },
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts
  const m = Math.floor(d / 60_000)
  const h = Math.floor(d / 3_600_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

export default function NotificationsPage() {
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications()

  useEffect(() => {
    if (unreadCount > 0) markAllRead()
  }, [unreadCount, markAllRead])

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 bg-cream py-6">
        <div className="max-w-[680px] mx-auto px-6">
          <div className="flex items-center justify-between mb-5">
            <h1 className="font-serif text-[22px] text-text-primary">Notifications</h1>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-copper hover:underline"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-[11px] text-danger hover:underline"
                >
                  <Trash2 size={12} /> Clear all
                </button>
              </div>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <Bell size={40} className="text-text-faint" strokeWidth={1.2} />
              <p className="text-[14px] font-medium text-text-muted">No notifications yet</p>
              <p className="text-[12px] text-text-faint text-center max-w-[280px]">
                Bid activity, auction results, and settlements will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => {
                const cfg  = TYPE_CONFIG[n.type]
                const Icon = cfg.icon
                const row = (
                  <div
                    onClick={() => markRead(n.id)}
                    className={[
                      'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                      n.read
                        ? 'bg-surface border-border hover:bg-cream'
                        : 'bg-copper/5 border-copper/20 hover:bg-copper/8',
                    ].join(' ')}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-current/10 ${cfg.iconCls}`}>
                      <Icon size={16} className={cfg.iconCls} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[13px] leading-snug ${n.read ? 'text-text-muted' : 'font-medium text-text-primary'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-text-faint flex-shrink-0 font-mono">
                          {timeAgo(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-faint mt-0.5">{n.message}</p>
                      {!!n.amount_paisa && n.amount_paisa > 0 && (
                        <p className="text-[12px] font-mono font-medium text-copper mt-1">
                          {paisaToRs(n.amount_paisa)}
                        </p>
                      )}
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-copper flex-shrink-0 mt-2" />
                    )}
                  </div>
                )

                return n.href ? (
                  <Link key={n.id} href={n.href}>{row}</Link>
                ) : (
                  <div key={n.id}>{row}</div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
