'use client'

import {
  createContext, useContext, useState, useCallback,
  useRef, useEffect, type ReactNode,
} from 'react'
import { notificationFeedback } from './sounds'

export type NotificationType = 'bid' | 'won' | 'settled' | 'info' | 'error'

export interface AppNotification {
  id:              string
  type:            NotificationType
  title:           string
  message:         string
  timestamp:       number
  read:            boolean
  href?:           string
  amount_paisa?:   number
  auction_id?:     string
  listing_id?:     string
  transaction_id?: string
}

interface NotificationContextValue {
  notifications:   AppNotification[]
  unreadCount:     number
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void
  markAllRead:     () => void
  markRead:        (id: string) => void
  clearAll:        () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const idRef = useRef(0)

  const addNotification = useCallback(
    (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      const notif: AppNotification = {
        ...n,
        id:        `notif-${Date.now()}-${idRef.current++}`,
        timestamp: Date.now(),
        read:      false,
      }
      setNotifications(prev => [notif, ...prev].slice(0, 50))

      if (n.type === 'bid')     notificationFeedback.bid()
      if (n.type === 'won')     notificationFeedback.won()
      if (n.type === 'settled') notificationFeedback.settled()

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(n.title, {
            body:     n.message,
            icon:     '/favicon.ico',
            tag:      n.type,
          })
        } catch { /* blocked */ }
      }
    },
    []
  )

  const markAllRead = useCallback(() =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true }))), [])

  const markRead = useCallback((id: string) =>
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)), [])

  const clearAll = useCallback(() => setNotifications([]), [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAllRead, markRead, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}

export function useRequestPushPermission() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {})
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [])
}
