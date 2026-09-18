import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { WeeklyRetro } from '@/lib/v5/types'
import { V5_TABLES } from '@/lib/v5/tables'
import { forbidden, getSession, handleRouteError, isMissingTableError, loadUserMap, missingTableResponse, optionalText, readJson } from '@/lib/v5/api'

const RETRO_SELECT = 'id, week_label, went_well, to_improve, action_items, kpi_snapshot, created_by, created_at'

// 다음 주로 넘어가면서 액션 아이템 체크박스를 토글하거나 회고 내용을 다듬을 때 쓴다.
const retroPatchSchema = z.object({
  wentWell: optionalText,
  toImprove: optionalText,
  actionItems: z.array(z.object({ text: z.string().trim().min(1).max(300), done: z.boolean() })).max(20).optional()
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session

    const input = retroPatchSchema.parse(await readJson(request))
    const patch: Record<string, unknown> = {}
    if (input.wentWell !== undefined) patch.went_well = input.wentWell || null
    if (input.toImprove !== undefined) patch.to_improve = input.toImprove || null
    if (input.actionItems !== undefined) patch.action_items = input.actionItems

    const { data, error } = await supabaseAdmin.from(V5_TABLES.weeklyRetros).update(patch).eq('id', id).select(RETRO_SELECT).single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }

    const userMap = await loadUserMap(supabaseAdmin, [data.created_by])
    const item: WeeklyRetro = { ...(data as Omit<WeeklyRetro, 'author_name'>), author_name: data.created_by ? userMap.get(data.created_by) || null : null }
    return NextResponse.json({ item })
  } catch (e) {
    return handleRouteError(e, '성장 회고 수정 실패')
  }
}
