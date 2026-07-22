import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

const SORT_KEYS = ['title', 'view_count', 'uploaded_at'] as const

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || ''
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1)
    const pageSize = 10
    const sortKeyRaw = url.searchParams.get('sortKey') || 'uploaded_at'
    const sortDirRaw = (url.searchParams.get('sortDir') || 'desc').toLowerCase()

    if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
      return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 400 })
    }

    const sortKey = (SORT_KEYS.includes(sortKeyRaw as any) ? sortKeyRaw : 'uploaded_at') as (typeof SORT_KEYS)[number]
    const ascending = sortDirRaw === 'asc'

    const { data: userRow } = await supabaseAdmin.from('crm_users').select('id, name').eq('id', userId).maybeSingle()
    const userName = userRow?.name || '이름 없음'

    let query = supabaseAdmin
      .from('videos')
      .select('id, title, youtube_url, published_at, created_at, view_count', { count: 'exact' })
      .eq('primary_owner_user_id', userId)

    if (sortKey === 'title') {
      query = query.order('title', { ascending, nullsFirst: false })
    } else if (sortKey === 'view_count') {
      query = query.order('view_count', { ascending, nullsFirst: false })
    } else {
      // uploaded_at: published_at이 없으면 created_at이라서, created_at로 정렬합니다.
      query = query.order('created_at', { ascending })
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const { data: items, error, count } = await query.range(from, to)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      user: { id: userId, name: userName },
      pagination: { page, pageSize, totalCount: count || 0 },
      sort: { sortKey, sortDir: ascending ? 'asc' : 'desc' },
      items:
        (items || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          youtube_url: item.youtube_url,
          uploaded_at: item.published_at || item.created_at,
          view_count: item.view_count
        })) || []
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '업로드 내역 조회 실패' }, { status: 500 })
  }
}

