import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sha256 } from '@/lib/crypto'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { SIGNUP_CHALLENGE_SECRET } from '@/lib/app-config'

const bodySchema = z.object({
  email: z.string().email(),
  loginId: z.string().min(2).max(30),
  name: z.string().min(1).max(50),
  birthDate: z.string().regex(/^\d{8}$/),
  phoneMid: z.string().regex(/^\d{4}$/),
  phoneLast: z.string().regex(/^\d{4}$/),
  password: z.string().min(6),
  antiBotCode: z.string().regex(/^\d{4}$/)
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const cookieStore = await cookies()
    const cookieHash = cookieStore.get('signup_challenge')?.value

    if (!cookieHash) {
      return NextResponse.json({ error: '자동가입방지 숫자를 먼저 발급받아 주세요.' }, { status: 400 })
    }

    const expected = sha256(`${body.antiBotCode}:${SIGNUP_CHALLENGE_SECRET}`)

    if (cookieHash !== expected) {
      return NextResponse.json({ error: '자동가입방지 4자리 숫자가 일치하지 않습니다.' }, { status: 400 })
    }

    const birthIso = `${body.birthDate.slice(0, 4)}-${body.birthDate.slice(4, 6)}-${body.birthDate.slice(6, 8)}`
    const phone = `010-${body.phoneMid}-${body.phoneLast}`

    const supabaseAdmin = createSupabaseAdminClient()
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    const emailExists = (userList.users || []).some((user) => user.email?.toLowerCase() === body.email.toLowerCase())
    if (emailExists) {
      return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 400 })
    }

    const { data: existingLoginId } = await supabaseAdmin
      .from('crm_users')
      .select('id, auth_user_id')
      .eq('login_id', body.loginId)
      .maybeSingle()

    if (existingLoginId) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 400 })
    }

    const { data: created, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        login_id: body.loginId,
        display_name: body.name
      }
    })

    if (createAuthError || !created.user) {
      return NextResponse.json({ error: createAuthError?.message || '회원가입에 실패했습니다.' }, { status: 400 })
    }

    const { error: profileError } = await supabaseAdmin.from('crm_users').insert({
      auth_user_id: created.user.id,
      email: body.email,
      name: body.name,
      login_id: body.loginId,
      birth_date: birthIso,
      phone,
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
