'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import AdminListingRow from '@/components/admin/AdminListingRow'
import type { AdminListingRow as AdminListingRowType } from '@/types'

const FILTERS = ['ACTIVE', 'PENDING_REVIEW', 'SOLD', 'ALL'] as const
type Filter = typeof FILTERS[number]

export default function AdminListingsPage() {
  const [listings, setListings] = useState<AdminListingRowType[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [filter, setFilter]     = useState<Filter>('ACTIVE')

  useEffect(() => {
    setLoading(true)
    setError(null)

    const status = filter === 'ALL' ? undefined : filter

    // Try admin endpoint; fall back to public listings endpoint if it doesn't exist
    api.admin.getListings({ status, limit: 50 })
      .then(r => { setListings(r.data); setLoading(false) })
      .catch(() => {
        api.listings.list({ status, limit: 50 })
          .then(r => {
            setListings(r.data as unknown as AdminListingRowType[])
            setLoading(false)
          })
          .catch(e => {
            setError(e instanceof Error ? e.message : 'Failed to load listings')
            setLoading(false)
          })
      })
  }, [filter])

  return (
    <div className="px-6 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[22px]">Listings</h1>
        <span className="bg-cream border border-border rounded px-2 py-0.5 text-[11px] text-text-muted">
          {listings.length} records
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'text-[11px] px-3 py-1 rounded transition-colors',
              filter === f
                ? 'bg-obs text-white'
                : 'text-text-muted hover:bg-cream cursor-pointer',
            ].join(' ')}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-[11px] text-danger">{error}</p>
      )}

      {/* Table */}
      <div className="w-full bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-cream border-b border-border">
            <tr>
              {['Device', 'Vetting', 'PTA', 'Reserve', 'Status', 'Age'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] text-text-faint uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="p-2">
                    <div className="h-8 bg-border animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : listings.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-text-faint text-[12px]">
                  No listings
                </td>
              </tr>
            ) : (
              listings.map(l => (
                <AdminListingRow key={l.listing_id} listing={l} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
