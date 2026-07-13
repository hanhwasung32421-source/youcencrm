import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 })
    }

    const { profile } = await getProfileByAccessToken(token)

    return NextResponse.json({
      crmUserId: profile.id,
      roleType: profile.role_type,
      name: profile.name,
      employmentStatus: profile.employment_status
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '프로필 조회 실패' }, { status: 401 })
  }
}

