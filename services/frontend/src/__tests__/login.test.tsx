import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock all next/navigation hooks used by the page and its children
jest.mock('next/navigation', () => ({
  useRouter:       () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: (_key: string) => null }),
  usePathname:     () => '/',
}))

// Mock Navbar and Footer so we don't have to mock their entire dependency tree
jest.mock('@/components/layout/Navbar', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-navbar" />,
}))
jest.mock('@/components/layout/Footer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-footer" />,
}))
jest.mock('@/components/layout/StatsBar', () => ({
  __esModule: true,
  default: () => null,
}))

// Mock api with correct camelCase method names matching api.ts
jest.mock('@/lib/api', () => ({
  api: {
    auth: {
      requestOtp: jest.fn().mockResolvedValue({ message: 'OTP sent', email: 'test@example.com' }),
      verifyOtp:  jest.fn().mockResolvedValue({
        access_token:     'fake-token',
        token_type:       'Bearer',
        expires_in:       900,
        user_id:          'fake-id',
        role:             'BUYER',
        kyc_tier:         'BASIC',
        profile_complete: true,
      }),
    },
  },
}))

// Mock auth to prevent localStorage side-effects
jest.mock('@/lib/auth', () => ({
  saveAuth:        jest.fn(),
  isAuthenticated: jest.fn().mockReturnValue(false),
  getAuth:         jest.fn().mockReturnValue(null),
  userInitials:    jest.fn().mockReturnValue('?'),
}))

import LoginPage from '@/app/login/page'

describe('LoginPage', () => {
  it('renders email input on step 1', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText(/you@email.com/i)).toBeInTheDocument()
  })

  it('shows error when Send OTP is clicked with empty email', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByText(/Send OTP to Email/i))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
  })

  it('shows error for email without @ sign', async () => {
    render(<LoginPage />)
    const input = screen.getByPlaceholderText(/you@email.com/i)
    await userEvent.type(input, 'notanemail')
    await userEvent.click(screen.getByText(/Send OTP to Email/i))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
  })

  it('advances to OTP step after valid email', async () => {
    render(<LoginPage />)
    const input = screen.getByPlaceholderText(/you@email.com/i)
    await userEvent.type(input, 'buyer1@boli.pk')
    await userEvent.click(screen.getByText(/Send OTP to Email/i))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })
  })

  it('renders demo accounts panel', () => {
    render(<LoginPage />)
    expect(screen.getByText(/Demo accounts/i)).toBeInTheDocument()
    expect(screen.getByText('seller@boli.pk')).toBeInTheDocument()
    expect(screen.getByText('buyer1@boli.pk')).toBeInTheDocument()
  })

  it('clicking demo account autofills email input', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByText('buyer1@boli.pk'))
    const input = screen.getByPlaceholderText(/you@email.com/i) as HTMLInputElement
    expect(input.value).toBe('buyer1@boli.pk')
  })
})
