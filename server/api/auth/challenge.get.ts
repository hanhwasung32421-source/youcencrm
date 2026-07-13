import { setCookie } from 'h3'
import { randomDigits, sha256 } from '../../utils/crypto'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()

  const code = randomDigits(4)
  const secret = config.signupChallengeSecret || 'change-me'
  const hash = sha256(`${code}:${secret}`)

  // 기존 코드가 있으면 덮어써서 즉시 무효화
  setCookie(event, 'signup_challenge', hash, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 5
  })

  // 사용자가 입력할 숫자
  return { code }
})
