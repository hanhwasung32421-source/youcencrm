import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)

    const today = new Date().toISOString().slice(0, 10)
    const dayStart = `${today}T00:00:00.000Z`

    const { count: videoCount } = await supabaseAdmin
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dayStart)

    const { count: unknownIpCount } = await supabaseAdmin
      .from('login_events')
      .select('*', { count: 'exact', head: true })
      .eq('network_zone_type', 'unknown')
      .gte('logged_in_at', dayStart)

    const { data: latest } = await supabaseAdmin
      .from('videos')
      .select('id, title, stock_name, content_type, view_count')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      todayRegisteredCount: videoCount || 0,
      unknownIpCount: unknownIpCount || 0,
      latest: latest || []
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '관리자 대시보드 조회 실패' }, { status: 500 })
  }
}

