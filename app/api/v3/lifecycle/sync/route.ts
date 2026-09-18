import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { fetchYoutubeVideoMeta } from '@/lib/youtube/api'
import { authenticate, loadActiveYoutubeApiKey, loadScopedVideos, loadVideosByIds, readJson } from '@/lib/v3/server'
import { SHARED_TABLES } from '@/lib/v3/tables'

const bodySchema = z.object({ videoId: z.string().uuid().optional() })
const MAX_PER_CALL = 10

// "통계 새로고침": youtubeCRM_youtube_accounts 의 활성 API 키로 최신 조회수/좋아요/댓글 수를
// 가져와 youtubeCRM_videos 를 갱신하고, youtubeCRM_video_snapshots 에 시점 스냅샷을 쌓는다.
// 이렇게 쌓인 스냅샷이 "조회 성장 곡선(라이프사이클)" 페이지의 데이터가 된다.
export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile, isAdmin } = auth

  try {
    const body = bodySchema.parse((await readJson(request)) || {})

    const apiKey = await loadActiveYoutubeApiKey(supabaseAdmin)
    if (!apiKey) {
      return NextResponse.json({ error: '활성화된 유튜브 API 키가 없어 통계를 새로고침할 수 없습니다.' }, { status: 400 })
    }

    let targets
    if (body.videoId) {
      const [video] = await loadVideosByIds(supabaseAdmin, [body.videoId])
      if (!video) return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 })
      if (!isAdmin && video.primary_owner_user_id !== profile.id) {
        return NextResponse.json({ error: '본인이 등록한 영상만 새로고침할 수 있습니다.' }, { status: 403 })
      }
      targets = [video]
    } else {
      targets = (await loadScopedVideos(supabaseAdmin, { isAdmin, selfUserId: profile.id, limit: MAX_PER_CALL })).filter((v) => v.youtube_url)
    }

    const results: { id: string; title: string; viewCount: number; ok: boolean; error?: string }[] = []

    for (const video of targets) {
      if (!video.youtube_url) continue
      try {
        const meta = await fetchYoutubeVideoMeta(video.youtube_url, apiKey)
        const now = new Date().toISOString()

        const { error: updateError } = await supabaseAdmin
          .from(SHARED_TABLES.videos)
          .update({
            view_count: meta.viewCount,
            like_count: meta.likeCount,
            comment_count: meta.commentCount,
            last_synced_at: now
          })
          .eq('id', video.id)
        if (updateError) throw new Error(updateError.message)

        const { error: snapshotError } = await supabaseAdmin.from(SHARED_TABLES.videoSnapshots).insert({
          video_id: video.id,
          snapshot_at: now,
          view_count: meta.viewCount,
          like_count: meta.likeCount,
          comment_count: meta.commentCount,
          privacy_status: meta.privacyStatus,
          raw_json: meta
        })
        if (snapshotError) throw new Error(snapshotError.message)

        results.push({ id: video.id, title: video.title || video.stock_name || '(제목 없음)', viewCount: meta.viewCount, ok: true })
      } catch (e: any) {
        results.push({ id: video.id, title: video.title || video.stock_name || '(제목 없음)', viewCount: video.view_count || 0, ok: false, error: e?.message })
      }
    }

    return NextResponse.json({ updated: results.filter((r) => r.ok).length, total: results.length, results })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    if (firstIssue?.message) return NextResponse.json({ error: firstIssue.message }, { status: 400 })
    return errorResponse(e, '통계 새로고침에 실패했습니다.')
  }
}
