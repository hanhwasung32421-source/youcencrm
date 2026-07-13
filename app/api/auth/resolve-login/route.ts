import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const bodySchema = z.object({
  loginId: z.string().min(1)
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const supabaseAdmin = createSupabaseAdminClient()

    const { data, error } = await supabaseAdmin
      .from('crm_users')
      .select('email')
      .eq('login_id', body.loginId)
      .maybeSingle()

    if (error || !data?.email) {
      return NextResponse.json({ error: '아이디를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ email: data.email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '아이디 조회 실패' }, { status: 500 })
  }
}

