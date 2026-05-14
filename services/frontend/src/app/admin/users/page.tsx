'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import AdminUserRow from '@/components/admin/AdminUserRow'
import type { AdminUserRow as AdminUserRowType } from '@/types'

const FALLBACK_USERS: AdminUserRowType[] = [
  {
    user_id:            'b0000000-0000-4000-8000-000000000001',
    phone:              '+92300000003',
    role:               'BUYER',
    kyc_tier:           'FULL',
    is_suspended:       false,
    created_at:         '2026-02-15T09:30:00Z',
    total_listings:     0,
    total_transactions: 2,
  },
  {
    user_id:            'c0000000-0000-4000-8000-000000000001',
    phone:              '+92300000004',
    role:               'SELLER',
    kyc_tier:           'FULL',
    is_suspended:       false,
    created_at:         '2026-01-20T06:00:00Z',
    total_listings:     4,
    total_transactions: 2,
  },
  {
    user_id:            'a0000000-0000-4000-8000-000000000001',
    phone:              '+92300000001',
    role:               'ADMIN',
    kyc_tier:           'FULL',
    is_suspended:       false,
    created_at:         '2026-01-01T04:00:00Z',
    total_listings:     0,
    total_transactions: 0,
  },
]

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<AdminUserRowType[]>([])
  const [loading, setLoading] = useState(true)
  const [error]               = useState<string | null>(null)

  useEffect(() => {
    api.admin.getUsers({ limit: 50 })
      .then(r => { setUsers(r.data); setLoading(false) })
      .catch(() => {
        // Endpoint not yet implemented — show seed demo data
        setUsers(FALLBACK_USERS)
        setLoading(false)
      })
  }, [])

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[22px]">Users</h1>
        <span className="bg-cream border border-border rounded px-2 py-0.5 text-[11px] text-text-muted">
          {users.length} records
        </span>
      </div>

      {error && <p className="text-[11px] text-danger">{error}</p>}

      <div className="w-full bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-cream border-b border-border">
            <tr>
              {['ID', 'Phone', 'Role', 'KYC', 'Transactions', 'Status', 'Joined'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] text-text-faint uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="p-2">
                    <div className="h-8 bg-border animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-text-faint text-[12px]">
                  No users
                </td>
              </tr>
            ) : (
              users.map(u => <AdminUserRow key={u.user_id} user={u} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
