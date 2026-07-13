import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sha256 } from '@/lib/crypto'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  code: z.string().regex(/^\d{4}$/)
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const cookieStore = await cookies()
    const cookieHash = cookieStore.get('signup_challenge')?.value

    if (!cookieHash) {
      return NextResponse.json({ error: '가입 인증 숫자를 먼저 발급받아 주세요.' }, { status: 400 })
    }

    const secret = process.env.SIGNUP_CHALLENGE_SECRET || 'change-me'
    const expected = sha256(`${body.code}:${secret}`)

    if (cookieHash !== expected) {
      return NextResponse.json({ error: '4자리 숫자가 일치하지 않습니다.' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient()
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true
    })

    if (authError || !created.user) {
      return NextResponse.json({ error: authError?.message || '회원가입에 실패했습니다.' }, { status: 400 })
    }

    const { error: profileError } = await supabaseAdmin.from('crm_users').insert({
      auth_user_id: created.user.id,
      email: body.email,
      name: body.email.split('@')[0],
      role_type: 'staff',
      employment_status: 'active'
    })

    if (profileError) {
      return NextResponse.json({ error: `CRM 프로필 생성 실패: ${profileError.message}` }, { status: 500 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('signup_challenge', '', { maxAge: 0, path: '/' })
    return response
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '회원가입 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
