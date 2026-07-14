import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'
import { ensureDefaultYoutubeAccount } from '@/lib/default-youtube-account'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    await getProfileByAccessToken(token)

    const { supabaseAdmin } = await getProfileByAccessToken(token)
    const account = await ensureDefaultYoutubeAccount(supabaseAdmin)
    return NextResponse.json({ items: [account] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '유튜브 계정 목록 조회 실패' }, { status: 500 })
  }
}
