'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { getAuth } from '@/lib/auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const auth = getAuth()
    if (!auth) { router.push('/login'); return }
    if (auth.role !== 'ADMIN') { router.push('/'); return }
    setMounted(true)
  }, [router])

  if (!mounted) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 bg-cream overflow-auto">
        {children}
      </div>
    </div>
  )
}
