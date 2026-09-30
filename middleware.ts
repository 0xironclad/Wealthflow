import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/superbase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Pages skip static assets. A dynamic page hosting a server action must never match the
    // image-extension rule, or a spoofed x-wf-user-id would reach it unstripped.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // API routes always run middleware, so x-wf-user-id is always stripped or verified.
    '/api/:path*',
  ],
}
