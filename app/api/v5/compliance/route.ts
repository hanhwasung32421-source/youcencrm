import { NextResponse } from 'next/server'
import { V5_TABLES } from '@/lib/v5/tables'
import type { ComplianceCheck, ComplianceVideoRow } from '@/lib/v5/types'
import { getSession, handleRouteError, isMissingTableError, loadUserMap } from '@/lib/v5/api'

const VIDEO_LIMIT = 50

type VideoRow = {
  id: string
  title: string | null
  stock_name: string
  content_type: string
  published_at: string | null
  view_count: number | null
  youtube_url: string
  primary_owner_user_id: string
  created_at: string
}

function emptyCheck(videoId: string): ComplianceCheck {
  return {
    video_id: videoId,
    paid_ad_disclosed: false,
    stock_disclaimer: false,
    no_solicitation_notice: false,
    source_cited: false,
    thumbnail_reviewed: false,
    status: 'unchecked',
    reviewer_user_id: null,
    reviewer_name: null,
    note: null,
    updated_at: null
  }
}

// 실제 youtubeCRM_videos(최신 50건, 직원은 본인 영상)에 체크리스트를 붙인다.
// 체크 테이블이 아직 없으면 전부 "미확인"으로 내려주고 sample: true 로 표시한다.
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session

    let videoQuery = supabaseAdmin
      .from(V5_TABLES.videos)
      .select('id, title, stock_name, content_type, published_at, view_count, youtube_url, primary_owner_user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(VIDEO_LIMIT)
    if (!isAdmin) videoQuery = videoQuery.eq('primary_owner_user_id', profile.id)
    const { data: videos, error: videoError } = await videoQuery
    if (videoError) throw videoError
    const videoRows = (videos || []) as VideoRow[]
    const videoIds = videoRows.map((v) => v.id)

    let checks: ComplianceCheck[] = []
    let sample = false
    if (videoIds.length > 0) {
      const { data, error } = await supabaseAdmin.from(V5_TABLES.complianceChecks).select('*').in('video_id', videoIds)
      if (error) {
        if (isMissingTableError(error)) sample = true
        else throw error
      } else {
        checks = (data || []) as ComplianceCheck[]
      }
    } else {
      // 영상이 없어도 테이블 존재 여부는 알려준다.
      const { error } = await supabaseAdmin.from(V5_TABLES.complianceChecks).select('video_id').limit(1)
      if (error && isMissingTableError(error)) sample = true
    }

    const userMap = await loadUserMap(supabaseAdmin, [
      ...videoRows.map((v) => v.primary_owner_user_id),
      ...checks.map((c) => c.reviewer_user_id)
    ])

    const items: ComplianceVideoRow[] = videoRows.map((v) => {
      const found = checks.find((c) => c.video_id === v.id)
      const check = found ? { ...found, reviewer_name: found.reviewer_user_id ? userMap.get(found.reviewer_user_id) || null : null } : emptyCheck(v.id)
      return {
        video: {
          id: v.id,
          title: v.title,
          stock_name: v.stock_name,
          content_type: v.content_type,
          published_at: v.published_at,
          view_count: v.view_count,
          youtube_url: v.youtube_url,
          owner_user_id: v.primary_owner_user_id,
          owner_name: userMap.get(v.primary_owner_user_id) || null,
          created_at: v.created_at
        },
        check
      }
    })

    const summary = {
      total: items.length,
      passed: items.filter((i) => i.check.status === 'passed').length,
      needsFix: items.filter((i) => i.check.status === 'needs_fix').length,
      unchecked: items.filter((i) => i.check.status === 'unchecked').length
    }

    return NextResponse.json({ sample, items, summary })
  } catch (e) {
    return handleRouteError(e, '컴플라이언스 목록 조회 실패')
  }
}
