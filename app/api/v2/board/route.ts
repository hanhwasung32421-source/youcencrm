import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api/error-response'
import { V2_TABLES } from '@/lib/v2/tables'
import { addDays, kstDayStart, kstYmd } from '@/lib/v2/dates'
import {
  authedContext,
  countVideosByUser,
  decorateItems,
  handleRouteError,
  isMissingTableError,
  loadStaff,
  loadTargets
} from '@/lib/v2/server'
import { sampleBoardFor } from '@/lib/v2/sample-data'
import type { BoardPayload } from '@/lib/v2/types'

// 제작 보드 한 화면에 필요한 것: 미완료 아이템 + 오늘 완료 아이템, 담당자 목록,
// 담당자별 목표/오늘 등록 영상 수. 직원은 자기 것만.
export async function GET(request: Request) {
  try {
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)
    const today = kstYmd()
    const todayStart = kstDayStart(today).toISOString()
    const tomorrowStart = kstDayStart(addDays(today, 1)).toISOString()

    let query = supabaseAdmin
      .from(V2_TABLES.productionItems)
      .select('*')
      .or(`stage.neq.done,updated_at.gte.${todayStart}`)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    if (!isAdmin) query = query.eq('assignee_user_id', profile.id)

    const { data: rows, error } = await query
    if (error) {
      if (isMissingTableError(error)) return NextResponse.json(sampleBoardFor(profile, isAdmin))
      return errorResponse(error, '제작 보드 조회 실패')
    }

    const allStaff = await loadStaff(supabaseAdmin)
    let staff = isAdmin ? allStaff : allStaff.filter((s) => s.id === profile.id)
    if (!isAdmin && staff.length === 0) staff = [{ id: profile.id, name: profile.name, roleType: profile.role_type }]
    const staffIds = staff.map((s) => s.id)

    const [items, targets, doneToday] = await Promise.all([
      decorateItems(supabaseAdmin, rows || []),
      loadTargets(supabaseAdmin, staffIds),
      countVideosByUser(supabaseAdmin, todayStart, tomorrowStart, staffIds)
    ])

    const payload: BoardPayload = { items, staff, targets, doneToday, today }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, '제작 보드 조회 실패')
  }
}
