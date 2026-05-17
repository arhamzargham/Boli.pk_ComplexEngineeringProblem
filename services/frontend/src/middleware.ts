import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = [
  '/account',
  '/my-listings',
  '/my-bids',
  '/wallet',
  '/sell/create',
  '/sell/imei',
  '/sell/vetting',
  '/kyc',
  '/auction',
  '/meetup',
  '/notifications',
  '/disputes',
  '/transactions',
  '/admin',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('boli_token')?.value

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))

  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
