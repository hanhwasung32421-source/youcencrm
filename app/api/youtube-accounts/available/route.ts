import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    await getProfileByAccessToken(token)

    const { supabaseAdmin } = await getProfileByAccessToken(token)
    const { data, error } = await supabaseAdmin
      .from('youtube_accounts')
      .select('id, account_name, channel_id, channel_name')
      .eq('is_active', true)
      .order('account_name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '유튜브 계정 목록 조회 실패' }, { status: 500 })
  }
}

