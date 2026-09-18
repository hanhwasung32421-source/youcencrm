import { NextResponse } from 'next/server'
import { fetchYoutubeVideoMeta } from '@/lib/youtube/api'
import { V5_TABLES } from '@/lib/v5/tables'
import { forbidden, getSession, handleRouteError } from '@/lib/v5/api'

// 최근 등록 영상 N개의 유튜브 통계를 다시 받아와 youtubeCRM_videos 를 갱신하고
// youtubeCRM_video_snapshots 에 스냅샷을 남긴다(알고리즘 친화도의 "초기 성장" 축 계산용).
// 공용 테이블에 쓰는 유일한 V5 라우트. 관리자 전용.
const SYNC_LIMIT = 40
const CONCURRENCY = 5

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session

    const { data: accounts, error: accountError } = await supabaseAdmin
      .from(V5_TABLES.youtubeAccounts)
      .select('id, account_name, api_key, api_active, is_active')
      .eq('api_active', true)
      .order('created_at', { ascending: true })
      .limit(5)
    if (accountError) throw accountError
    const account = (accounts || []).find((a: any) => a.api_key && a.is_active !== false) || (accounts || [])[0]
    if (!account?.api_key) {
      return NextResponse.json({ error: '활성화된 유튜브 API 키가 없습니다. 유튜브 계정에서 API를 활성화해 주세요.' }, { status: 409 })
    }

    const { data: videos, error: videoError } = await supabaseAdmin
      .from(V5_TABLES.videos)
      .select('id, youtube_video_id, youtube_url')
      .order('created_at', { ascending: false })
      .limit(SYNC_LIMIT)
    if (videoError) throw videoError

    const targets = (videos || []) as Array<{ id: string; youtube_video_id: string | null; youtube_url: string | null }>
    const syncedAt = new Date().toISOString()
    let updated = 0
    const failures: string[] = []

    const syncOne = async (video: (typeof targets)[number]) => {
      const url = video.youtube_url || (video.youtube_video_id ? `https://www.youtube.com/watch?v=${video.youtube_video_id}` : '')
      if (!url) {
        failures.push(video.id)
        return
      }
      try {
        const meta = await fetchYoutubeVideoMeta(url, account.api_key as string)
        const { error: updateError } = await supabaseAdmin
          .from(V5_TABLES.videos)
          .update({
            view_count: meta.viewCount,
            like_count: meta.likeCount,
            comment_count: meta.commentCount,
            last_synced_at: syncedAt
          })
          .eq('id', video.id)
        if (updateError) throw updateError
        const { error: snapshotError } = await supabaseAdmin.from(V5_TABLES.videoSnapshots).insert({
          video_id: video.id,
          snapshot_at: syncedAt,
          view_count: meta.viewCount,
          like_count: meta.likeCount,
          comment_count: meta.commentCount,
          privacy_status: meta.privacyStatus
        })
        if (snapshotError) {
          // 스냅샷 테이블 기록 실패는 통계 갱신 자체를 실패로 보지 않는다(서버 로그만).
          console.error('V5 sync-stats snapshot insert 실패', snapshotError)
        }
        updated += 1
      } catch (e) {
        console.error('V5 sync-stats 영상 갱신 실패', video.id, e)
        failures.push(video.id)
      }
    }

    // 유튜브 API 쿼터/속도를 고려해 5개씩 병렬 처리
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      await Promise.all(targets.slice(i, i + CONCURRENCY).map(syncOne))
    }

    return NextResponse.json({ updated, failed: failures.length, total: targets.length, syncedAt, accountName: account.account_name })
  } catch (e) {
    return handleRouteError(e, '통계 새로고침 실패')
  }
}
