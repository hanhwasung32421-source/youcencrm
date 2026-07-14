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
      .select('id, title, stock_name, content_type, view_count, published_at, created_at, duration_seconds, youtube_url')
      .eq('primary_owner_user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(6)

    const since = new Date()
    since.setDate(since.getDate() - 6)
    const sinceIso = since.toISOString()

    const { data: chartRows } = await supabaseAdmin
      .from('videos')
      .select('id, title, content_type, view_count, duration_seconds, created_at')
      .eq('primary_owner_user_id', profile.id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })

    const { count: longformCount } = await supabaseAdmin
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('primary_owner_user_id', profile.id)
      .eq('content_type', 'longform')

    const { count: shortformCount } = await supabaseAdmin
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('primary_owner_user_id', profile.id)
      .eq('content_type', 'shortform')

    const dayLabels = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = date.toISOString().slice(0, 10)
      return {
        key,
        label: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
        value: 0
      }
    })

    for (const row of chartRows || []) {
      const key = String(row.created_at || '').slice(0, 10)
      const target = dayLabels.find((item) => item.key === key)
      if (target) target.value += 1
    }

    return NextResponse.json({
      todayRegisteredCount: count || 0,
      latest: latest || [],
      charts: {
        viewByLatest: (latest || []).slice().reverse().map((item) => ({
          label: item.title || item.stock_name || '제목 없음',
          value: item.view_count || 0
        })),
        durationByLatest: (latest || []).slice().reverse().map((item) => ({
          label: item.title || item.stock_name || '제목 없음',
          value: item.duration_seconds || 0
        })),
        dailyRegistrations: dayLabels.map((item) => ({
          label: item.label,
          value: item.value
        })),
        contentTypes: [
          { label: '롱폼', value: longformCount || 0 },
          { label: '숏폼', value: shortformCount || 0 }
        ]
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '대시보드 조회 실패' }, { status: 500 })
  }
}
