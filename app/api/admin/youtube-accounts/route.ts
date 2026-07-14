import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { ensureDefaultYoutubeAccount } from '@/lib/default-youtube-account'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  accountName: z.string().min(1, '계정 이름을 입력해 주세요.'),
  apiKey: z.string().optional().nullable(),
  channelId: z.string().optional().nullable(),
  channelName: z.string().optional().nullable()
})

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)
    await ensureDefaultYoutubeAccount(supabaseAdmin)

    const { data, error } = await supabaseAdmin
      .from('youtube_accounts')
      .select('id, account_name, api_key, channel_id, channel_name, is_active, api_active, api_last_error, api_last_checked_at, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '유튜브 계정 조회 실패' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await requireAdmin(body.accessToken)

    const { data, error } = await supabaseAdmin
      .from('youtube_accounts')
      .insert({
        account_name: body.accountName.trim(),
        api_key: body.apiKey?.trim() || '',
        channel_id: body.channelId?.trim() || null,
        channel_name: body.channelName?.trim() || null,
        is_active: true,
        api_active: false,
        api_last_error: null,
        api_last_checked_at: null
      })
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || '유튜브 계정 저장 실패' }, { status: 500 })
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: profile.id,
      action_type: 'create_youtube_account',
      target_type: 'youtube_account',
      target_id: data.id,
      diff_summary: {
        account_name: body.accountName,
        channel_id: body.channelId || null
      }
    })

    return NextResponse.json({ ok: true, id: data.id })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    return NextResponse.json({ error: firstIssue?.message || e?.message || '유튜브 계정 저장 실패' }, { status: 500 })
  }
}
