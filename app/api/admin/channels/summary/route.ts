import { NextResponse } from 'next/server'
import { getBearerToken, requireAdmin } from '@/lib/auth/session'
import { TABLES } from '@/lib/supabase/tables'
import { errorResponse } from '@/lib/api/error-response'

// video_analytics_daily/channel_analytics_daily는 수집 파이프라인이 없어 항상 빈 테이블이라
// 실제로 쌓이는 youtubeCRM_videos의 영상별 통계를 채널(youtube_account) 단위로 즉석 합산한다.
export async function GET(request: Request) {
  try {
    const token = getBearerToken(request)
    const { supabaseAdmin } = await requireAdmin(token)

    const [{ data: accounts, error: accountsError }, { data: videos, error: videosError }] = await Promise.all([
      supabaseAdmin
        .from(TABLES.youtubeAccounts)
        .select('id, account_name, channel_name, is_active')
        .order('account_name', { ascending: true }),
      supabaseAdmin
        .from(TABLES.videos)
        .select('youtube_account_id, view_count, like_count, comment_count')
    ])

    if (accountsError) {
      return errorResponse(accountsError, '채널 요약 조회 실패')
    }
    if (videosError) {
      return errorResponse(videosError, '채널 요약 조회 실패')
    }

    type ChannelRow = {
      accountId: string
      name: string
      isActive: boolean
      videoCount: number
      viewCount: number
      likeCount: number
      commentCount: number
    }

    const rowMap = new Map<string, ChannelRow>()
    for (const account of accounts || []) {
      rowMap.set(account.id, {
        accountId: account.id,
        name: account.channel_name || account.account_name || '이름 없음',
        isActive: Boolean(account.is_active),
        videoCount: 0,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0
      })
    }

    let unassignedCount = 0
    for (const video of videos || []) {
      const accountId = video.youtube_account_id
      const row = accountId ? rowMap.get(accountId) : null
      if (!row) {
        unassignedCount += 1
        continue
      }
      row.videoCount += 1
      row.viewCount += Number(video.view_count || 0)
      row.likeCount += Number(video.like_count || 0)
      row.commentCount += Number(video.comment_count || 0)
    }

    const rows = Array.from(rowMap.values()).sort((a, b) => b.viewCount - a.viewCount)

    return NextResponse.json({ rows, unassignedCount })
  } catch (e: any) {
    return errorResponse(e, '채널 요약 조회 실패')
  }
}
