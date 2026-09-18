// 실험(A/B 로그) 라우트가 공유하는 스키마/매퍼. route.ts는 HTTP 핸들러만 export할 수 있어 여기로 분리.

import { z } from 'zod'
import { stockKey, videoTitle, type VideoRow } from '@/lib/v4/analytics'
import type { ExperimentItem } from '@/lib/v4/sample-data'
import { loadUsers, type V4Context } from '@/lib/v4/server'
import { V4_TABLES } from '@/lib/v4/tables'

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 합니다.')

export const experimentInputSchema = z.object({
  videoId: z.uuid().nullable().optional(),
  hypothesis: z.string().trim().min(1, '가설을 입력해 주세요.').max(2000),
  variantA: z.string().trim().min(1, '변형 A 설명을 입력해 주세요.').max(2000),
  variantB: z.string().trim().min(1, '변형 B 설명을 입력해 주세요.').max(2000),
  metric: z.string().trim().min(1, '지표를 입력해 주세요.').max(500),
  startedOn: ymd,
  endedOn: ymd.nullable().optional(),
  winner: z.enum(['a', 'b', 'tie']).nullable().optional(),
  learning: z.string().trim().max(4000).nullable().optional()
})

export type ExperimentInput = z.infer<typeof experimentInputSchema>

export const EXPERIMENT_SELECT =
  'id, video_id, hypothesis, variant_a, variant_b, metric, started_on, ended_on, winner, learning, created_by, created_at, updated_at'

export type ExperimentRow = {
  id: string
  video_id: string | null
  hypothesis: string
  variant_a: string
  variant_b: string
  metric: string
  started_on: string
  ended_on: string | null
  winner: 'a' | 'b' | 'tie' | null
  learning: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type VideoOption = { id: string; title: string; stockName: string; contentType: string; createdAt: string }

// 실험 폼의 영상 선택 옵션 (최근 300개, 직원은 본인 것만)
export async function loadVideoOptions(ctx: V4Context): Promise<VideoOption[]> {
  let q = ctx.supabaseAdmin
    .from(V4_TABLES.videos)
    .select('id, title, title_override, youtube_video_id, stock_name, content_type, created_at, primary_owner_user_id')
    .order('created_at', { ascending: false })
    .limit(300)
  if (!ctx.isAdmin) q = q.eq('primary_owner_user_id', ctx.profile.id)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return ((data || []) as Array<Partial<VideoRow> & { id: string; created_at: string }>).map((v) => ({
    id: v.id,
    title: videoTitle(v as VideoRow),
    stockName: stockKey(v as VideoRow),
    contentType: v.content_type || 'longform',
    createdAt: v.created_at
  }))
}

export async function mapExperiments(ctx: V4Context, rows: ExperimentRow[]): Promise<ExperimentItem[]> {
  const videoIds = Array.from(new Set(rows.map((r) => r.video_id).filter((id): id is string => Boolean(id))))
  const [{ map: userMap }, videoMap] = await Promise.all([
    loadUsers(ctx.supabaseAdmin),
    (async () => {
      if (videoIds.length === 0) return new Map<string, VideoRow>()
      const { data, error } = await ctx.supabaseAdmin
        .from(V4_TABLES.videos)
        .select('id, title, title_override, youtube_video_id, stock_name')
        .in('id', videoIds)
      if (error) throw new Error(error.message)
      return new Map(((data || []) as VideoRow[]).map((v) => [v.id, v]))
    })()
  ])
  return rows.map((r) => {
    const video = r.video_id ? videoMap.get(r.video_id) : undefined
    return {
      id: r.id,
      videoId: r.video_id,
      videoTitle: video ? videoTitle(video) : '(영상 미연결)',
      stockName: video ? stockKey(video) : '-',
      hypothesis: r.hypothesis,
      variantA: r.variant_a,
      variantB: r.variant_b,
      metric: r.metric,
      startedOn: r.started_on,
      endedOn: r.ended_on,
      winner: r.winner,
      learning: r.learning,
      createdBy: r.created_by,
      createdByName: (r.created_by && userMap.get(r.created_by)?.name) || '알 수 없음',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }
  })
}
