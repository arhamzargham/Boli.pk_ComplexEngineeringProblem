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

/** User initials for avatar display */
export function userInitials(userId: string | null): string {
  if (!userId) return '?'
  // Derive from stored role for CEP — production would use real name
  const role = typeof window !== 'undefined' ? localStorage.getItem(KEYS.role) : null
  if (role === 'ADMIN') return 'AD'
  if (role === 'SELLER') return 'MK'
  return 'AK'
}
