import { NextResponse } from 'next/server'
import { randomDigits, sha256 } from '@/lib/crypto'
import { SIGNUP_CHALLENGE_SECRET } from '@/lib/app-config'

export async function GET() {
  const code = randomDigits(4)
  const hash = sha256(`${code}:${SIGNUP_CHALLENGE_SECRET}`)

  const response = NextResponse.json({ code })
  response.cookies.set('signup_challenge', hash, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 5
  })

  return response
}
