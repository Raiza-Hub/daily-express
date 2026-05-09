import { NextRequest, NextResponse } from 'next/server'

const publicRoutes = [
  '/',
  '/sign-in',
  '/sign-up',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]

const authRoutes = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname

  const isPublicRoute = publicRoutes.includes(path)
  const isAuthRoute = authRoutes.includes(path)

  const token = req.cookies.get('token')?.value
  const refreshToken = req.cookies.get('refreshToken')?.value
  const hasAuth = !!(token || refreshToken)

  if (!hasAuth && !isPublicRoute) {
    const loginUrl = new URL('/sign-in', req.url)
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  if (hasAuth && isAuthRoute) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // daily-express-flow is excluded because it's a rewrite to PostHog (see next.config.js).
    // The proxy runs before next.config.js rewrites, so without this exclusion,
    // auth redirects would intercept PostHog asset requests and break analytics.
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opengraph-image|twitter-image|.*\\.png$|daily-express-flow).*)",
  ],
}
