import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  youtubeAccountId: z.string().uuid()
})

function extractYoutubeApiErrorMessage(payload: any) {
  const msg = payload?.error?.message
  if (typeof msg === 'string' && msg.trim()) return msg.trim()
  return null
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { supabaseAdmin } = await requireAdmin(body.accessToken)

    const { data: account, error: accountError } = await supabaseAdmin
      .from('youtube_accounts')
      .select('id, api_key')
      .eq('id', body.youtubeAccountId)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ error: '유튜브 계정을 찾을 수 없습니다.' }, { status: 404 })
    }

    const apiKey = String(account.api_key || '').trim()
    if (!apiKey) {
      await supabaseAdmin
        .from('youtube_accounts')
        .update({ api_active: false, api_last_error: 'API 키가 비어 있습니다.', api_last_checked_at: new Date().toISOString() })
        .eq('id', account.id)
      return NextResponse.json({ error: 'API 키가 비어 있습니다.' }, { status: 400 })
    }

    // 유효성만 확인하기 위한 고정 테스트 (공개 영상)
    const testVideoId = 'dQw4w9WgXcQ'
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${testVideoId}&part=id&key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg = extractYoutubeApiErrorMessage(json) || 'YouTube API 연결에 실패했습니다.'
      await supabaseAdmin
        .from('youtube_accounts')
        .update({ api_active: false, api_last_error: msg, api_last_checked_at: new Date().toISOString() })
        .eq('id', account.id)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    await supabaseAdmin
      .from('youtube_accounts')
      .update({ api_active: true, api_last_error: null, api_last_checked_at: new Date().toISOString() })
      .eq('id', account.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    return NextResponse.json({ error: firstIssue?.message || e?.message || 'API 활성화 실패' }, { status: 500 })
  }
}

