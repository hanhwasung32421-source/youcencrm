import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfileByAccessToken } from '@/lib/auth'
import { extractYoutubeVideoId, fetchYoutubeVideoMeta } from '@/lib/youtube'
import { ensureDefaultYoutubeAccount } from '@/lib/default-youtube-account'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  youtubeUrl: z.string().url(),
  contentType: z.enum(['longform', 'shortform']),
  stockName: z.string().min(1),
  contentCategory: z.string().optional().nullable()
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await getProfileByAccessToken(body.accessToken)
    const youtubeAccount = await ensureDefaultYoutubeAccount(supabaseAdmin)

    const apiActive = Boolean((youtubeAccount as any).api_active)
    const apiKey = String((youtubeAccount as any).api_key || '').trim()

    let meta:
      | Awaited<ReturnType<typeof fetchYoutubeVideoMeta>>
      | {
          youtubeVideoId: string
          youtubeChannelId: string
          channelName: string
          title: string
          description: string
          publishedAt: string | null
          durationSeconds: number | null
          privacyStatus: string | null
          thumbnailUrl: string | null
          viewCount: number | null
          likeCount: number | null
          commentCount: number | null
        }

    if (apiActive && apiKey) {
      meta = await fetchYoutubeVideoMeta(body.youtubeUrl, apiKey)
    } else {
      const youtubeVideoId = extractYoutubeVideoId(body.youtubeUrl)
      if (!youtubeVideoId) {
        return NextResponse.json({ error: '유효한 유튜브 영상 주소가 아닙니다.' }, { status: 400 })
      }

      const channelIdText = String((youtubeAccount as any).channel_id || '').trim()
      const channelNameText = String((youtubeAccount as any).channel_name || '').trim()
      if (!channelIdText) {
        return NextResponse.json(
          {
            error:
              '현재는 API가 비활성 상태입니다. 유튜브 계정에 채널 ID를 입력하거나, 관리자에서 API 활성화를 먼저 해 주세요.'
          },
          { status: 400 }
        )
      }

      meta = {
        youtubeVideoId,
        youtubeChannelId: channelIdText,
        channelName: channelNameText || `채널-${channelIdText.slice(0, 8)}`,
        title: '',
        description: '',
        publishedAt: null,
        durationSeconds: null,
        privacyStatus: null,
        thumbnailUrl: null,
        viewCount: null,
        likeCount: null,
        commentCount: null
      }
    }

    let channelId: string | null = null
    const { data: existingChannel } = await supabaseAdmin
      .from('channels')
      .select('id')
      .eq('youtube_channel_id', meta.youtubeChannelId)
      .maybeSingle()

    if (existingChannel?.id) {
      channelId = existingChannel.id
    } else {
      const { data: newChannel, error: channelInsertError } = await supabaseAdmin
        .from('channels')
        .insert({
          youtube_channel_id: meta.youtubeChannelId,
          name: meta.channelName || `채널-${meta.youtubeChannelId.slice(0, 8)}`,
          status: 'active',
          is_active: true
        })
        .select('id')
        .single()

      if (channelInsertError || !newChannel) {
        return NextResponse.json({ error: channelInsertError?.message || '채널 생성 실패' }, { status: 500 })
      }
      channelId = newChannel.id
    }

    const { data: insertedVideo, error: upsertError } = await supabaseAdmin
      .from('videos')
      .upsert(
        {
          youtube_video_id: meta.youtubeVideoId,
          youtube_account_id: youtubeAccount.id,
          channel_id: channelId,
          primary_owner_user_id: profile.id,
          youtube_url: body.youtubeUrl,
          content_type: body.contentType,
          stock_name: body.stockName,
          content_category: body.contentCategory || null,
          publish_state: apiActive ? 'published' : null,
          title: meta.title || null,
          description: meta.description || null,
          privacy_status: meta.privacyStatus,
          published_at: meta.publishedAt,
          duration_seconds: meta.durationSeconds,
          thumbnail_url: meta.thumbnailUrl,
          view_count: meta.viewCount,
          like_count: meta.likeCount,
          comment_count: meta.commentCount,
          last_synced_at: apiActive ? new Date().toISOString() : null
        },
        { onConflict: 'youtube_video_id' }
      )
      .select('id, youtube_video_id, title, published_at, view_count, like_count, comment_count')
      .single()

    if (upsertError || !insertedVideo) {
      return NextResponse.json({ error: upsertError?.message || '영상 저장 실패' }, { status: 500 })
    }

    if (apiActive) {
      await supabaseAdmin.from('video_snapshots').insert({
        video_id: insertedVideo.id,
        snapshot_at: new Date().toISOString(),
        view_count: meta.viewCount,
        like_count: meta.likeCount,
        comment_count: meta.commentCount,
        privacy_status: meta.privacyStatus,
        raw_json: meta
      })
    }

    await supabaseAdmin.from('work_activity_events').insert({
      user_id: profile.id,
      activity_type: 'video_registered',
      related_channel_id: channelId,
      related_video_id: insertedVideo.id,
      payload_summary: {
        youtube_account_id: youtubeAccount.id,
        youtube_account_name: youtubeAccount.account_name,
        youtube_video_id: meta.youtubeVideoId,
        stock_name: body.stockName,
        content_type: body.contentType,
        api_active: apiActive
      }
    })

    return NextResponse.json({ ok: true, video: insertedVideo })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    return NextResponse.json({ error: firstIssue?.message || e?.message || '영상 저장 실패' }, { status: 500 })
  }
}
