import type { AuthResponse, Listing, ListingDetail, ListingsResponse, Auction, Wallet } from '@/types'

// Server components (SSR): direct URL. Client components: proxy via Next.js rewrite.
const BASE =
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://localhost:8080')
    : ''

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('boli_token')
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
  },

  auctions: {
    get: (id: string) => apiFetch<Auction>(`/api/v1/auctions/${id}`),
  },

  wallet: {
    get: () => apiFetch<Wallet>('/api/v1/wallet'),
  },

  auth: {
    requestOtp: (phone: string) =>
      apiFetch<{ message: string }>('/api/v1/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
    verifyOtp: (phone: string, otp: string) =>
      apiFetch<AuthResponse>('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      }),
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
  },
}
