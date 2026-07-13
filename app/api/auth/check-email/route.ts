import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const bodySchema = z.object({
  email: z.string().email()
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const supabaseAdmin = createSupabaseAdminClient()

    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const exists = (data.users || []).some((user) => user.email?.toLowerCase() === body.email.toLowerCase())
    return NextResponse.json({ exists })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '이메일 중복확인 실패' }, { status: 400 })
  }
}

