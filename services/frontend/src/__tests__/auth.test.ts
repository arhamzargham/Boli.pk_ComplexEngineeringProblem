import { isAuthenticated, getToken, getUserId, getRole } from '@/lib/auth'

// Mock localStorage using a simple in-memory store
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear:      () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

describe('auth utilities', () => {
  beforeEach(() => localStorageMock.clear())

  it('isAuthenticated returns false when no token', () => {
    expect(isAuthenticated()).toBe(false)
  })

  it('isAuthenticated returns true when boli_token exists', () => {
    localStorageMock.setItem('boli_token', 'test-jwt')
    expect(isAuthenticated()).toBe(true)
  })

  it('getToken returns null when not set', () => {
    expect(getToken()).toBeNull()
  })

  it('getToken returns token stored under boli_token', () => {
    localStorageMock.setItem('boli_token', 'my-jwt')
    expect(getToken()).toBe('my-jwt')
  })

  it('getUserId returns null when not set', () => {
    expect(getUserId()).toBeNull()
  })

  it('getUserId returns the stored user ID', () => {
    localStorageMock.setItem('boli_user_id', 'user-123')
    expect(getUserId()).toBe('user-123')
  })

  it('getRole returns null when not set', () => {
    expect(getRole()).toBeNull()
  })

  it('getRole returns the stored role', () => {
    localStorageMock.setItem('boli_role', 'BUYER')
    expect(getRole()).toBe('BUYER')
  })
})
