import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth/session'
import { TABLES } from '@/lib/supabase/tables'
import { errorResponse } from '@/lib/api/error-response'

const PAGE_SIZE = 20

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)

    const url = new URL(request.url)
    const page = Math.max(Number(url.searchParams.get('page') || '1'), 1)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabaseAdmin
      .from(TABLES.videos)
      .select(
        'id, title, stock_name, content_type, published_at, view_count, like_count, comment_count, youtube_url, created_at, youtube_account_id',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    if (profile.role_type !== 'super_admin' && profile.role_type !== 'admin') {
      query = query.eq('primary_owner_user_id', profile.id)
    }

    const { data, error, count } = await query

    if (error) {
      return errorResponse(error, '영상 목록 조회 실패')
    }

    return NextResponse.json({
      items: data || [],
      pagination: { page, pageSize: PAGE_SIZE, totalCount: count || 0 }
    })
  } catch (e: any) {
    return errorResponse(e, '영상 목록 조회 실패')
  }
}

