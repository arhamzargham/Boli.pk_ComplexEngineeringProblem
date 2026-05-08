'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListFilter, Users, Wallet } from 'lucide-react'

const NAV = [
  { href: '/admin',          icon: LayoutDashboard, label: 'Dashboard'     },
  { href: '/admin/listings', icon: ListFilter,      label: 'Listings Queue' },
  { href: '/admin/users',    icon: Users,           label: 'Users'         },
  { href: '/admin/wallets',  icon: Wallet,          label: 'Fund Wallet'   },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <aside className="w-[220px] min-h-screen bg-obs flex-shrink-0 flex flex-col border-r border-white/5">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/5">
        <p className="font-serif text-[18px] text-copper">Boli.pk</p>
        <p className="text-[10px] text-white/40 mt-0.5">Admin Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={[
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] transition-colors',
              isActive(href)
                ? 'bg-copper/15 text-copper'
                : 'text-white/60 hover:bg-white/5 hover:text-white',
            ].join(' ')}
          >
            <Icon size={14} className="flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Back link */}
      <div className="border-t border-white/5 px-4 py-3">
        <Link href="/" className="text-[11px] text-white/40 hover:text-white/70 transition-colors">
          ← Back to marketplace
        </Link>
      </div>
    </aside>
  )
}
