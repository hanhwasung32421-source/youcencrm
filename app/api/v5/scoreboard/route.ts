import { NextResponse } from 'next/server'
import { computeScoreboard, type SnapshotRow } from '@/lib/v5/scoring'
import { V5_TABLES } from '@/lib/v5/tables'
import { SCORE_TIERS, type VideoRef } from '@/lib/v5/types'
import { getSession, handleRouteError, loadUserMap } from '@/lib/v5/api'

const VIDEO_LIMIT = 300

// 알고리즘 친화도 스코어보드 — youtubeCRM_videos(+ video_snapshots)는 이미 존재하는
// 공용 테이블이라 "테이블 없음" 샘플 폴백이 필요 없다(SQL 실행 전에도 바로 동작).
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin } = session

    const { data: videoRows, error } = await supabaseAdmin
      .from(V5_TABLES.videos)
      .select('id, title, stock_name, content_type, published_at, view_count, like_count, comment_count, youtube_url, thumbnail_url, primary_owner_user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(VIDEO_LIMIT)
    if (error) throw error

    const videos = (videoRows || []) as VideoRef[]
    const userMap = await loadUserMap(supabaseAdmin, videos.map((v) => v.primary_owner_user_id))
    const videosWithOwner = videos.map((v) => ({ ...v, owner_name: v.primary_owner_user_id ? userMap.get(v.primary_owner_user_id) || null : null }))

    const snapshotsByVideoId = new Map<string, SnapshotRow[]>()
    if (videos.length > 0) {
      const ids = videos.map((v) => v.id)
      const { data: snapshotRows } = await supabaseAdmin
        .from(V5_TABLES.videoSnapshots)
        .select('video_id, snapshot_at, view_count, like_count, comment_count')
        .in('video_id', ids)
        .order('snapshot_at', { ascending: true })
      for (const row of (snapshotRows || []) as SnapshotRow[]) {
        const list = snapshotsByVideoId.get(row.video_id) || []
        list.push(row)
        snapshotsByVideoId.set(row.video_id, list)
      }
    }

    const rows = computeScoreboard(videosWithOwner, snapshotsByVideoId).sort((a, b) => b.totalScore - a.totalScore)
    const distribution = SCORE_TIERS.map((tier) => ({ tier, count: rows.filter((r) => r.tier === tier).length }))

    return NextResponse.json({ items: rows, distribution })
  } catch (e) {
    return handleRouteError(e, '스코어보드 조회 실패')
  }
}
