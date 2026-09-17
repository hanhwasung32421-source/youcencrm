import { NextResponse } from 'next/server'
import { getBearerToken, getProfileByAccessToken } from '@/lib/auth/session'
import { TABLES } from '@/lib/supabase/tables'
import { errorResponse } from '@/lib/api/error-response'

export async function POST(request: Request) {
  try {
    const { profile, supabaseAdmin } = await getProfileByAccessToken(getBearerToken(request))

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const ip = forwarded.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent') || null

    const { error } = await supabaseAdmin.from(TABLES.loginEvents).insert({
      user_id: profile.id,
      ip_address: ip,
      user_agent: userAgent,
      success: true,
      network_zone_type: 'unknown',
      risk_level: 'low'
    })

    if (error) {
      return errorResponse(error, '로그인 기록 실패')
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '로그인 기록 실패' }, { status: 500 })
  }
}

