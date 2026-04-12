import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
