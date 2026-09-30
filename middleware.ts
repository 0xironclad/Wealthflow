import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/superbase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // General pages: skip static assets and anything ending in an image
    // extension. No dynamic segments exist under src/app today, so that
    // exclusion can't currently match a real page -- but if a future
    // dynamic PAGE route (e.g. something under a [id] segment) that hosts
    // a server action ever ends in one of these extensions, it would skip
    // middleware and reach getSessionUserId() with an unstripped, spoofable
    // x-wf-user-id header. Keep that constraint in mind before adding such
    // a route.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Every API route always runs middleware regardless of its path shape,
    // so the header can never reach a handler unstripped/unverified.
    '/api/:path*',
  ],
}
