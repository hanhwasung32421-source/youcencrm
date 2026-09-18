import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { DEFAULT_DAILY_TARGET, V2_TABLES } from '@/lib/v2/tables'
import { authedContext, forbidden, handleDbError, handleRouteError, isAdminRole, isMissingTableError, loadStaff, nowIso } from '@/lib/v2/server'
import { sampleStaffTargets } from '@/lib/v2/sample-data'
import type { StaffTargetsPayload } from '@/lib/v2/types'

const bodySchema = z.object({
  userId: z.string().uuid(),
  dailyTarget: z.number().int().min(0, '목표는 0 이상이어야 합니다.').max(200)
})

// 관리자: 담당자별 일일 목표 (기본 12)
export async function GET(request: Request) {
  try {
    const { supabaseAdmin, isAdmin } = await authedContext(request)
    if (!isAdmin) return forbidden()

    const staff = (await loadStaff(supabaseAdmin)).filter((s) => !isAdminRole(s.roleType || ''))
    const { data, error } = await supabaseAdmin.from(V2_TABLES.staffTargets).select('user_id, daily_target')
    if (error) {
      if (isMissingTableError(error)) return NextResponse.json(sampleStaffTargets())
      return errorResponse(error, '일일 목표 조회 실패')
    }
    const map = new Map<string, number>()
    for (const row of (data || []) as { user_id: string; daily_target: number }[]) map.set(row.user_id, Number(row.daily_target))

    const payload: StaffTargetsPayload = {
      items: staff.map((s) => ({ userId: s.id, name: s.name, dailyTarget: map.get(s.id) ?? DEFAULT_DAILY_TARGET }))
    }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, '일일 목표 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { supabaseAdmin, isAdmin } = await authedContext(request)
    if (!isAdmin) return forbidden()

    const { error } = await supabaseAdmin
      .from(V2_TABLES.staffTargets)
      .upsert({ user_id: body.userId, daily_target: body.dailyTarget, updated_at: nowIso() }, { onConflict: 'user_id' })
    if (error) return handleDbError(error, '일일 목표 저장 실패')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '일일 목표 저장 실패')
  }
}
