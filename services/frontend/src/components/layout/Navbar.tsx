'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { getAuth, userInitials } from '@/lib/auth'
import { api } from '@/lib/api'
import { paisaToRs } from '@/lib/formatters'
import type { Wallet } from '@/types'

interface NavbarProps {
  variant?: 'main' | 'minimal'
}

const NAV_LINKS = [
  { href: '/',       label: 'Marketplace'   },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/sell',   label: 'Sell a device' },
  { href: '/wallet', label: 'Wallet'        },
]

export default function Navbar({ variant = 'main' }: NavbarProps) {
  const pathname  = usePathname()
  const [open, setOpen]     = useState(false)
  const [mounted, setMounted] = useState(false)
  const [auth, setAuth]     = useState<ReturnType<typeof getAuth>>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)

  useEffect(() => {
    const a = getAuth()
    setAuth(a)
    setMounted(true)
    if (a) {
      api.wallet.get().then(setWallet).catch(() => {})
    }
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  if (variant === 'minimal') {
    return (
      <nav className="bg-obs px-6 h-[52px] flex items-center sticky top-0 z-50">
        <Link href="/" className="font-serif text-[20px] text-copper">
          Boli.pk
        </Link>
      </nav>
    )
  }

  return (
    <nav className="bg-obs sticky top-0 z-50 border-b border-white/5">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-[52px] flex items-center">

        {/* Logo */}
        <Link href="/" className="font-serif text-[20px] text-copper flex-shrink-0 mr-8">
          Boli.pk
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7 flex-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-[13px] pb-0.5 transition-colors ${
                isActive(href)
                  ? 'text-white border-b-2 border-copper'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          {mounted && auth ? (
            <>
              {auth.kycTier === 'BASIC' && (
                <Link
                  href="/kyc"
                  className="bg-reviewed-bg text-reviewed-text text-[9px] px-2 py-0.5 rounded border border-reviewed-text/20 hover:opacity-80 transition-opacity"
                >
                  KYC BASIC → Upgrade
                </Link>
              )}
              {wallet && (
                <span className="text-[12px] text-copper font-mono">
                  {paisaToRs(wallet.available_paisa)}
                </span>
              )}
              <div className="w-8 h-8 rounded-full bg-copper/15 border border-copper/30 flex items-center justify-center text-copper text-[11px] font-medium select-none">
                {userInitials(auth.userId)}
              </div>
            </>
          ) : mounted ? (
            <Link
              href="/login"
              className="bg-copper text-white text-[12px] px-3.5 py-2 rounded-[9px] hover:bg-copper/90 transition-colors"
            >
              Login
            </Link>
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto text-white/70 hover:text-white p-1.5"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-obs-90 border-t border-white/10 px-6 pb-4">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block py-3 text-[13px] border-b border-white/[0.07] last:border-0 ${
                isActive(href) ? 'text-copper' : 'text-white/70'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="pt-3">
            {mounted && auth ? (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-copper/15 flex items-center justify-center text-copper text-[10px]">
                  {userInitials(auth.userId)}
                </div>
                {wallet && (
                  <span className="text-[12px] text-copper font-mono">
                    {paisaToRs(wallet.available_paisa)}
                  </span>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block w-full bg-copper text-white text-center py-2.5 rounded-[9px] text-[13px]"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
