import { readBody } from 'h3'
import { z } from 'zod'
import { getSupabaseAdmin } from '../../utils/supabaseAdmin'
import { getSupabasePublic } from '../../utils/supabasePublic'
import { fetchYoutubeVideoMeta } from '../../utils/youtube'

const BodySchema = z.object({
  accessToken: z.string().min(10),
  youtubeUrl: z.string().url(),
  contentType: z.enum(['longform', 'shortform']),
  stockName: z.string().min(1),
  contentCategory: z.string().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const body = BodySchema.parse(await readBody(event))

  const supabasePublic = getSupabasePublic()
  const { data: userData, error: userError } = await supabasePublic.auth.getUser(body.accessToken)
  if (userError || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: '로그인이 필요합니다.' })
  }

  const admin = getSupabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('crm_users')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'CRM 프로필을 찾을 수 없습니다.' })
  }

  const meta = await fetchYoutubeVideoMeta(body.youtubeUrl)

  // 채널 확보
  let channelId: string | null = null
  const { data: existingChannel } = await admin
    .from('channels')
    .select('id')
    .eq('youtube_channel_id', meta.youtubeChannelId)
    .maybeSingle()

  if (existingChannel?.id) {
    channelId = existingChannel.id
  } else {
    const { data: newChannel, error: channelInsertError } = await admin
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
      throw createError({
        statusCode: 500,
        statusMessage: channelInsertError?.message || '채널 생성에 실패했습니다.'
      })
    }
    channelId = newChannel.id
  }

  // 영상 저장 또는 갱신
  const payload = {
    youtube_video_id: meta.youtubeVideoId,
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
  }

  const { data: insertedVideo, error: upsertError } = await admin
    .from('videos')
    .upsert(payload, { onConflict: 'youtube_video_id' })
    .select('id, youtube_video_id, title, published_at, view_count, like_count, comment_count')
    .single()

  if (upsertError || !insertedVideo) {
    throw createError({
      statusCode: 500,
      statusMessage: upsertError?.message || '영상 저장에 실패했습니다.'
    })
  }

  // 스냅샷 저장
  await admin.from('video_snapshots').insert({
    video_id: insertedVideo.id,
    snapshot_at: new Date().toISOString(),
    view_count: meta.viewCount,
    like_count: meta.likeCount,
    comment_count: meta.commentCount,
    privacy_status: meta.privacyStatus,
    raw_json: meta
  })

  // 활동 이벤트 저장
  await admin.from('work_activity_events').insert({
    user_id: profile.id,
    activity_type: 'video_registered',
    related_channel_id: channelId,
    related_video_id: insertedVideo.id,
    payload_summary: {
      youtube_video_id: meta.youtubeVideoId,
      stock_name: body.stockName,
      content_type: body.contentType
    }
  })

  return {
    ok: true,
    video: insertedVideo
  }
})

