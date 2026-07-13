import { getCookie, setCookie, readBody } from 'h3'
import { z } from 'zod'
import { sha256 } from '../../utils/crypto'
import { getSupabaseAdmin } from '../../utils/supabaseAdmin'

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  code: z.string().regex(/^\d{4}$/)
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.signupChallengeSecret || 'change-me'

  const body = BodySchema.parse(await readBody(event))

  const cookieHash = getCookie(event, 'signup_challenge')
  if (!cookieHash) {
    throw createError({ statusCode: 400, statusMessage: '가입 인증 숫자를 먼저 발급받아 주세요.' })
  }

  const expected = sha256(`${body.code}:${secret}`)
  if (cookieHash !== expected) {
    throw createError({ statusCode: 400, statusMessage: '4자리 숫자가 일치하지 않습니다.' })
  }

  // 성공/실패와 무관하게 1회성으로 처리(재사용 방지)
  setCookie(event, 'signup_challenge', '', { path: '/', maxAge: 0 })

  const admin = getSupabaseAdmin()

  // Supabase Auth 사용자 생성 (서비스 롤 필요)
  const { data: created, error: createError2 } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true
  })
  if (createError2 || !created.user) {
    throw createError({ statusCode: 400, statusMessage: createError2?.message || '회원가입에 실패했습니다.' })
  }

  // CRM 프로필 생성 (초기: staff)
  // 테이블은 supabase SQL 적용 후 정상 동작합니다.
  const { error: profileError } = await admin
    .from('crm_users')
    .insert({
      auth_user_id: created.user.id,
      email: body.email,
      name: body.email.split('@')[0],
      role_type: 'staff',
      employment_status: 'active'
    })

  if (profileError) {
    // Auth는 생성됐지만 CRM 프로필 실패. 운영상 중요해서 에러로 돌려줌.
    throw createError({
      statusCode: 500,
      statusMessage: `CRM 프로필 생성 실패: ${profileError.message}`
    })
  }

  return { ok: true }
})
