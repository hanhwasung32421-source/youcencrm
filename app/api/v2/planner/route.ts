import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { TABLES } from '@/lib/supabase/tables'
import { V2_TABLES } from '@/lib/v2/tables'
import { addDays, kstDayStart, kstDayEnd, kstYmd, weekStartMonday } from '@/lib/v2/dates'
import { computeTimingHint, handleDbError, handleRouteError, isMissingTableError, loadStaff, requireV2Admin } from '@/lib/v2/server'
import { samplePlannerPayload } from '@/lib/v2/sample-data'
import type { PlannedSlot, PlannerPayload } from '@/lib/v2/types'

// 발행 모멘텀 플래너: 요일 × 담당자 업로드 계획(planned_slots) vs 실제 등록 수, 최적 발행 시간 힌트
export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await requireV2Admin(request)
    const url = new URL(request.url)
    const weekStart = weekStartMonday(url.searchParams.get('weekStart') || kstYmd())
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const weekEnd = days[days.length - 1]

    const staff = await loadStaff(supabaseAdmin)
    const staffIds = staff.map((s) => s.id)

    const { data: slotRows, error: slotError } = await supabaseAdmin
      .from(V2_TABLES.plannedSlots)
      .select('id, staff_user_id, planned_date, planned_hour, note, created_at')
      .in('staff_user_id', staffIds.length > 0 ? staffIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('planned_date', weekStart)
      .lte('planned_date', weekEnd)
    if (slotError) {
      if (isMissingTableError(slotError)) return NextResponse.json(samplePlannerPayload(weekStart))
      return errorResponse(slotError, '플래너 조회 실패')
    }

    const planned: PlannerPayload['planned'] = {}
    const actual: PlannerPayload['actual'] = {}
    for (const s of staff) {
      planned[s.id] = {}
      actual[s.id] = {}
      for (const day of days) {
        planned[s.id][day] = []
        actual[s.id][day] = 0
      }
    }
    for (const row of (slotRows || []) as PlannedSlot[]) {
      if (planned[row.staff_user_id] && planned[row.staff_user_id][row.planned_date]) {
        planned[row.staff_user_id][row.planned_date].push(row)
      }
    }

    if (staffIds.length > 0) {
      const { data: videoRows } = await supabaseAdmin
        .from(TABLES.videos)
        .select('primary_owner_user_id, created_at')
        .in('primary_owner_user_id', staffIds)
        .gte('created_at', kstDayStart(weekStart).toISOString())
        .lt('created_at', kstDayEnd(weekEnd).toISOString())
      for (const row of (videoRows || []) as { primary_owner_user_id: string; created_at: string }[]) {
        const day = kstYmd(new Date(row.created_at))
        if (actual[row.primary_owner_user_id] && day in actual[row.primary_owner_user_id]) {
          actual[row.primary_owner_user_id][day] += 1
        }
      }
    }

    const { data: timingRows } = await supabaseAdmin.from(TABLES.videos).select('published_at, view_count').order('created_at', { ascending: false }).limit(500)
    const timingHint = computeTimingHint((timingRows || []) as { published_at: string | null; view_count: number | null }[])

    const payload: PlannerPayload = { weekStart, days, staff, planned, actual, timingHint }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, '플래너 조회 실패')
  }
}

const createSchema = z.object({
  staffUserId: z.string().uuid(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.'),
  plannedHour: z.number().int().min(0).max(23),
  note: z.string().trim().max(200).optional().nullable()
})

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json())
    const { supabaseAdmin } = await requireV2Admin(request)

    const { data, error } = await supabaseAdmin
      .from(V2_TABLES.plannedSlots)
      .insert({ staff_user_id: body.staffUserId, planned_date: body.plannedDate, planned_hour: body.plannedHour, note: body.note || null })
      .select('id, staff_user_id, planned_date, planned_hour, note, created_at')
      .single()
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: '해당 담당자·시간에 이미 계획된 슬롯이 있습니다.' }, { status: 409 })
      }
      return handleDbError(error, '슬롯 등록 실패')
    }
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return handleRouteError(e, '슬롯 등록 실패')
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabaseAdmin } = await requireV2Admin(request)
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: '삭제할 슬롯 ID가 올바르지 않습니다.' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from(V2_TABLES.plannedSlots).delete().eq('id', id)
    if (error) return handleDbError(error, '슬롯 삭제 실패')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '슬롯 삭제 실패')
  }
}
