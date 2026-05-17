import type { AuthResponse, ListingDetail, ListingsResponse, Auction, Wallet, BidResponse, BidsListResponse, Transaction, AdminListingRow, AdminUserRow, Dispute } from '@/types'

// Server components (SSR): direct URL. Client components: proxy via Next.js rewrite.
const BASE =
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://localhost:8080')
    : ''

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('boli_token')
}

function uuid4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  listings: {
    list: (params: { status?: string; limit?: number; offset?: number; q?: string } = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return apiFetch<ListingsResponse>(`/api/v1/listings${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => apiFetch<ListingDetail>(`/api/v1/listings/${id}`),

    // Multipart form submission for new listing (photos + metadata)
    create: (formData: FormData): Promise<{ listing_id: string }> => {
      const token = getToken()
      return fetch(`${BASE}/api/v1/listings`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        cache: 'no-store',
      }).then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<{ listing_id: string }>
      })
    },
  },

  auctions: {
    get: (id: string) =>
      apiFetch<Auction>(`/api/v1/auctions/${id}`),

    getBids: (auctionId: string) =>
      apiFetch<BidsListResponse>(`/api/v1/auctions/${auctionId}/bids`),

    placeBid: (auctionId: string, amountPaisa: number) =>
      apiFetch<BidResponse>(`/api/v1/auctions/${auctionId}/bids`, {
        method: 'POST',
        body: JSON.stringify({
          amount_paisa:    amountPaisa,
          idempotency_key: uuid4(),
        }),
      }),
  },

  transactions: {
    get: (id: string) =>
      apiFetch<Transaction>(`/api/v1/transactions/${id}`),

    generateQr: (id: string) =>
      apiFetch<{ qr_data: string; expires_at: string; transaction_id: string }>(
        `/api/v1/transactions/${id}/qr/generate`,
        { method: 'POST' }
      ),

    confirmMeetup: (id: string, body: { proposed_at: string; location: string; notes: string }) =>
      apiFetch<{ ok: boolean }>(`/api/v1/transactions/${id}/meetup/confirm`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    settle: (id: string, body: { qr_token: string }) =>
      apiFetch<{ ok: boolean; receipt_hash?: string }>(`/api/v1/transactions/${id}/settle`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    raiseDispute: (txId: string, payload: { reason: string; description: string }) =>
      apiFetch<{ dispute_id: string }>(`/api/v1/transactions/${txId}/disputes`, {
        method: 'POST',
        body: JSON.stringify({
          transaction_id: txId,
          reason:         payload.reason,
          evidence_text:  payload.description,
        }),
      }),
  },

  disputes: {
    get: (disputeId: string) =>
      apiFetch<Dispute>(`/api/v1/disputes/${disputeId}`),
  },

  wallet: {
    get: () => apiFetch<Wallet>('/api/v1/wallet'),

    withdraw: (payload: { amount_paisa: number; bank_name: string; account_title: string; iban: string }) =>
      apiFetch<{ reference_id: string }>('/api/v1/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  vetting: {
    checkImei: (imei: string) =>
      apiFetch<{ imei: string; valid: boolean; blacklisted: boolean; message: string }>(
        '/api/v1/vetting/imei',
        { method: 'POST', body: JSON.stringify({ imei }) }
      ),
  },

  auth: {
    requestOtp: (payload: { email: string }) =>
      apiFetch<{ message: string; email: string }>('/api/v1/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    verifyOtp: (payload: { email: string; otp_code: string }) =>
      apiFetch<AuthResponse>('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  user: {
    profile: () =>
      apiFetch<{
        user_id: string
        email: string
        phone: string
        kyc_tier: string
        account_status: string
        trust_score: number
        role: string
        created_at: string
      }>('/api/v1/users/me'),
  },

  admin: {
    fundWallet: (userId: string, amountPaisa: number, note: string) =>
      apiFetch<{ wallet_id: string; funded_paisa: number; message: string }>(
        '/api/v1/admin/wallets/fund',
        {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, amount_paisa: amountPaisa, note }),
        }
      ),

    getListings: (params: { status?: string; limit?: number; offset?: number } = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return apiFetch<{ data: AdminListingRow[]; count: number }>(
        `/api/v1/admin/listings${qs ? `?${qs}` : ''}`
      )
    },

    getUsers: (params: { limit?: number; offset?: number } = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return apiFetch<{ data: AdminUserRow[]; count: number }>(
        `/api/v1/admin/users${qs ? `?${qs}` : ''}`
      )
    },

    updateListingStatus: (id: string, body: { status: 'active' | 'suspended' | 'sold' }) =>
      apiFetch<{ ok: boolean }>(`/api/v1/admin/listings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),

    updateUserStatus: (id: string, body: { kyc_status: 'verified' | 'pending' | 'rejected' }) =>
      apiFetch<{ ok: boolean }>(`/api/v1/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),

    getRiskFlags: () =>
      apiFetch<{ data: { entity_type: string; entity_id: string; risk_type: string; score: number; reason: string; created_at: string }[]; count: number }>(
        '/api/v1/admin/risk-flags'
      ),
  },
}
