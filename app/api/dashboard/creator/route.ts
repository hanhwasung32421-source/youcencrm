import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)

    const today = new Date().toISOString().slice(0, 10)
    const dayStart = `${today}T00:00:00.000Z`

    const { count } = await supabaseAdmin
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('primary_owner_user_id', profile.id)
      .gte('created_at', dayStart)

    const { data: latest } = await supabaseAdmin
      .from('videos')
      .select('id, title, stock_name, content_type, view_count')
      .eq('primary_owner_user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      todayRegisteredCount: count || 0,
      latest: latest || []
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '대시보드 조회 실패' }, { status: 500 })
  }
}

