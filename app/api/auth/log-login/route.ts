import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfileByAccessToken } from '@/lib/auth'

const bodySchema = z.object({
  accessToken: z.string().min(10)
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await getProfileByAccessToken(body.accessToken)

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const ip = forwarded.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent') || null

    const { error } = await supabaseAdmin.from('login_events').insert({
      user_id: profile.id,
      ip_address: ip,
      user_agent: userAgent,
      success: true,
      network_zone_type: 'unknown',
      risk_level: 'low'
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '로그인 기록 실패' }, { status: 500 })
  }
}

