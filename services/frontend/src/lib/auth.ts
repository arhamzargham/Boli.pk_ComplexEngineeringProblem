import type { AuthResponse } from '@/types'

const KEYS = {
  token:   'boli_token',
  userId:  'boli_user_id',
  role:    'boli_role',
  kycTier: 'boli_kyc_tier',
} as const

export function saveAuth(response: AuthResponse): void {
  localStorage.setItem(KEYS.token,   response.access_token)
  localStorage.setItem(KEYS.userId,  response.user_id)
  localStorage.setItem(KEYS.role,    response.role)
  localStorage.setItem(KEYS.kycTier, response.kyc_tier)
}

export function clearAuth(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k))
}

export function getAuth() {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(KEYS.token)
  if (!token) return null
  return {
    token,
    userId:  localStorage.getItem(KEYS.userId),
    role:    localStorage.getItem(KEYS.role) as 'BUYER' | 'SELLER' | 'ADMIN' | null,
    kycTier: localStorage.getItem(KEYS.kycTier) as 'BASIC' | 'FULL' | null,
  }
}

export function isAuthenticated(): boolean {
  return !!getAuth()
}

export function logout(): void {
  if (typeof window === 'undefined') return
  clearAuth()
  document.cookie = 'boli_token=; path=/; max-age=0; SameSite=Lax'
  window.location.href = '/login'
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEYS.token)
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEYS.userId)
}

export function getRole(): 'BUYER' | 'SELLER' | 'ADMIN' | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEYS.role) as 'BUYER' | 'SELLER' | 'ADMIN' | null
}

export function getAuthHeaders(): Record<string, string> {
  const auth = getAuth()
  return auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}
}

export function getTokenPayload(): Record<string, unknown> | null {
  const auth = getAuth()
  if (!auth?.token) return null
  try {
    const payload = auth.token.split('.')[1]
    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

export function isTokenExpired(): boolean {
  const payload = getTokenPayload()
  if (!payload || typeof payload.exp !== 'number') return true
  return Date.now() / 1000 > payload.exp
}

/** User initials for avatar display */
export function userInitials(userId: string | null): string {
  if (!userId) return '?'
  // Derive from stored role for CEP — production would use real name
  const role = typeof window !== 'undefined' ? localStorage.getItem(KEYS.role) : null
  if (role === 'ADMIN') return 'AD'
  if (role === 'SELLER') return 'MK'
  return 'AK'
}
