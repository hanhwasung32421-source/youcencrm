import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)

    let query = supabaseAdmin
      .from('videos')
      .select('id, title, stock_name, content_type, published_at, view_count, like_count, comment_count, youtube_url, created_at, youtube_account_id')
      .order('created_at', { ascending: false })
      .limit(20)

    if (profile.role_type !== 'super_admin' && profile.role_type !== 'admin') {
      query = query.eq('primary_owner_user_id', profile.id)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '영상 목록 조회 실패' }, { status: 500 })
  }
}

