import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { findAuthUserByEmail } from '@/lib/auth/session'

const bodySchema = z.object({
  email: z.string().email()
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const supabaseAdmin = createSupabaseAdminClient()

    const existing = await findAuthUserByEmail(supabaseAdmin, body.email)
    return NextResponse.json({ exists: Boolean(existing) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '이메일 중복확인 실패' }, { status: 400 })
  }
}

