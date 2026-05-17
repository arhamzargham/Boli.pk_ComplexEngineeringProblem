'use client'

import { useState, useEffect, useRef } from 'react'
import { useNotifications, useRequestPushPermission } from '@/lib/notifications'
import { ToastContainer } from './Toast'
import type { AppNotification } from '@/lib/notifications'

export function ToastManager() {
  const { notifications, markRead } = useNotifications()
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([])
  const seenIds = useRef(new Set<string>())

  useRequestPushPermission()

  useEffect(() => {
    const newest = notifications.find(n => !n.read && !seenIds.current.has(n.id))
    if (newest) {
      seenIds.current.add(newest.id)
      setActiveToasts(prev => [newest, ...prev].slice(0, 5))
    }
  }, [notifications])

  function dismiss(id: string) {
    setActiveToasts(prev => prev.filter(t => t.id !== id))
    markRead(id)
  }

  return <ToastContainer toasts={activeToasts} onDismiss={dismiss} />
}
