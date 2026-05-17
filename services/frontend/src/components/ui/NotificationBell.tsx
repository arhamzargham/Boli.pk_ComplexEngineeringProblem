'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/lib/notifications'

export function NotificationBell() {
  const { unreadCount } = useNotifications()
  return (
    <Link
      href="/notifications"
      className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell size={18} className="text-white/70" strokeWidth={1.5} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-copper text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
