// 발행 전략 플레이북 — GET/POST 라우트가 공유하는 select 컬럼 + 매핑 로직.

import { z } from 'zod'
import type { PlaybookEntry } from '@/lib/v5/types'
import { V5_TABLES } from '@/lib/v5/tables'
import { loadUserMap, optionalText, type Session } from '@/lib/v5/api'

export const PLAYBOOK_SELECT = 'id, title, when_to_use, example_video_id, tags, effect_note, usage_count, created_by, created_at'

export type PlaybookRow = Omit<PlaybookEntry, 'author_name' | 'example_video_title'>

export const playbookInputSchema = z.object({
  title: z.string().trim().min(1, '패턴 이름을 입력해 주세요.').max(200),
  whenToUse: z.string().trim().min(1, '언제 쓰는지 입력해 주세요.').max(1000),
  exampleVideoId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).optional().default([]),
  effectNote: optionalText
})

export async function mapPlaybook(supabaseAdmin: Session['supabaseAdmin'], rows: PlaybookRow[]): Promise<PlaybookEntry[]> {
  if (rows.length === 0) return []
  const userMap = await loadUserMap(supabaseAdmin, rows.map((r) => r.created_by))
  const videoIds = Array.from(new Set(rows.map((r) => r.example_video_id).filter((v): v is string => Boolean(v))))
  const videoMap = new Map<string, string | null>()
  if (videoIds.length > 0) {
    const { data } = await supabaseAdmin.from(V5_TABLES.videos).select('id, title').in('id', videoIds)
    for (const row of (data || []) as Array<{ id: string; title: string | null }>) videoMap.set(row.id, row.title)
  }
  return rows.map((r) => ({
    ...r,
    author_name: r.created_by ? userMap.get(r.created_by) || null : null,
    example_video_title: r.example_video_id ? videoMap.get(r.example_video_id) || null : null
  }))
}
