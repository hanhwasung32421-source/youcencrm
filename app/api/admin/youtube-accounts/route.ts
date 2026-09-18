import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getBearerToken, requireAdmin } from '@/lib/auth/session'
import { TABLES } from '@/lib/supabase/tables'
import { errorResponse } from '@/lib/api/error-response'

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  accountName: z.string().min(1),
  apiKey: z.string().min(1),
  channelId: z.string().optional().nullable(),
  channelName: z.string().optional().nullable(),
  isActive: z.boolean().optional()
})

// 유튜브 API 키가 실제로 동작하는지 채널/영상 정보 없이도 확인할 수 있는
// 가벼운 엔드포인트(i18nRegions)로 즉시 검증한다. 등록 즉시 "바로 적용"되는
// 것처럼 보이려면, 저장 시점에 키가 유효한지 알아야 한다.
async function verifyYoutubeApiKey(apiKey: string) {
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/i18nRegions?part=snippet&key=${encodeURIComponent(apiKey)}`, {
      cache: 'no-store'
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || 'API 키 확인에 실패했습니다.' }
    }
    return { ok: true, error: null as string | null }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'API 키 확인 중 오류가 발생했습니다.' }
  }
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await requireAdmin(getBearerToken(request))
    const { data, error } = await supabaseAdmin
      .from(TABLES.youtubeAccounts)
      .select('id, account_name, api_key, channel_id, channel_name, is_active, api_active, api_last_error, api_last_checked_at, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      return errorResponse(error, '유튜브 계정 목록 조회 실패')
    }

    return NextResponse.json({ items: data || [] })
  } catch (e: any) {
    return errorResponse(e, '유튜브 계정 목록 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { supabaseAdmin } = await requireAdmin(getBearerToken(request))

    const verify = await verifyYoutubeApiKey(body.apiKey)

    const payload = {
      account_name: body.accountName,
      api_key: body.apiKey,
      channel_id: body.channelId || null,
      channel_name: body.channelName || null,
      is_active: body.isActive ?? true,
      api_active: verify.ok,
      api_last_error: verify.error,
      api_last_checked_at: new Date().toISOString()
    }

    const query = body.id
      ? supabaseAdmin.from(TABLES.youtubeAccounts).update(payload).eq('id', body.id)
      : supabaseAdmin.from(TABLES.youtubeAccounts).insert(payload)

    const { data, error } = await query
      .select('id, account_name, api_key, channel_id, channel_name, is_active, api_active, api_last_error, api_last_checked_at')
      .single()

    if (error) {
      return errorResponse(error, '유튜브 계정 저장 실패')
    }

    return NextResponse.json({ ok: true, item: data, verified: verify.ok, error: verify.error })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    if (firstIssue?.message) {
      return NextResponse.json({ error: firstIssue.message }, { status: 500 })
    }
    return errorResponse(e, '유튜브 계정 저장 실패')
  }
}
