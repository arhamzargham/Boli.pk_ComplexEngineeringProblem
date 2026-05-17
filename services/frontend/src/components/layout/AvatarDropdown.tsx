'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { User, FileText, Gavel, Wallet, LogOut } from 'lucide-react'
import { getAuth, userInitials, logout } from '@/lib/auth'

const MENU_ITEMS = [
  { href: '/account',     icon: User,     label: 'My Account'  },
  { href: '/my-listings', icon: FileText, label: 'My Listings' },
  { href: '/my-bids',     icon: Gavel,    label: 'My Bids'     },
  { href: '/wallet',      icon: Wallet,   label: 'My Wallet'   },
] as const

export function AvatarDropdown() {
  const [open, setOpen]   = useState(false)
  const [auth, setAuth]   = useState<ReturnType<typeof getAuth>>(null)
  const ref               = useRef<HTMLDivElement>(null)

  useEffect(() => { setAuth(getAuth()) }, [])

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  if (!auth) return null

  const initials = userInitials(auth.userId)
  const role     = auth.role     ?? 'BUYER'
  const kycTier  = auth.kycTier  ?? 'BASIC'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full bg-copper/15 border border-copper/30 flex items-center
                   justify-center text-copper text-[11px] font-medium hover:bg-copper/25
                   transition-colors select-none"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-60 rounded-xl border border-white/10
                     bg-[#1C1917] shadow-2xl shadow-black/60 z-50 overflow-hidden"
          role="menu"
        >
          {/* Identity header */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-copper/15 border border-copper/30
                              flex items-center justify-center text-copper text-[11px]
                              font-medium shrink-0">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-[#B87333]">KYC {kycTier}</span>
                  <span className="text-white/20 text-xs">·</span>
                  <span className="text-xs text-white/50">{role}</span>
                </div>
                <p className="text-[11px] text-white/30 mt-0.5">Signed in</p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <div className="py-1">
            {MENU_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70
                           hover:bg-white/5 hover:text-white transition-colors"
              >
                <item.icon size={14} className="text-white/40 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-white/10 py-1">
            <button
              onClick={() => { setOpen(false); logout() }}
              role="menuitem"
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm
                         text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={14} className="shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
