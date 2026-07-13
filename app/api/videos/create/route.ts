import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfileByAccessToken } from '@/lib/auth'
import { fetchYoutubeVideoMeta } from '@/lib/youtube'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  youtubeAccountId: z.string().uuid(),
  youtubeUrl: z.string().url(),
  contentType: z.enum(['longform', 'shortform']),
  stockName: z.string().min(1),
  contentCategory: z.string().optional().nullable()
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await getProfileByAccessToken(body.accessToken)

    const { data: youtubeAccount, error: youtubeAccountError } = await supabaseAdmin
      .from('youtube_accounts')
      .select('id, account_name, api_key')
      .eq('id', body.youtubeAccountId)
      .eq('is_active', true)
      .maybeSingle()

    if (youtubeAccountError || !youtubeAccount) {
      return NextResponse.json({ error: '선택한 유튜브 계정을 찾을 수 없습니다.' }, { status: 404 })
    }

    const meta = await fetchYoutubeVideoMeta(body.youtubeUrl, youtubeAccount.api_key)

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
          publish_state: 'published',
          title: meta.title,
          description: meta.description,
          privacy_status: meta.privacyStatus,
          published_at: meta.publishedAt,
          duration_seconds: meta.durationSeconds,
          thumbnail_url: meta.thumbnailUrl,
          view_count: meta.viewCount,
          like_count: meta.likeCount,
          comment_count: meta.commentCount,
          last_synced_at: new Date().toISOString()
        },
        { onConflict: 'youtube_video_id' }
      )
      .select('id, youtube_video_id, title, published_at, view_count, like_count, comment_count')
      .single()

    if (upsertError || !insertedVideo) {
      return NextResponse.json({ error: upsertError?.message || '영상 저장 실패' }, { status: 500 })
    }

    await supabaseAdmin.from('video_snapshots').insert({
      video_id: insertedVideo.id,
      snapshot_at: new Date().toISOString(),
      view_count: meta.viewCount,
      like_count: meta.likeCount,
      comment_count: meta.commentCount,
      privacy_status: meta.privacyStatus,
      raw_json: meta
    })

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
        content_type: body.contentType
      }
    })

    return NextResponse.json({ ok: true, video: insertedVideo })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '영상 저장 실패' }, { status: 500 })
  }
}

