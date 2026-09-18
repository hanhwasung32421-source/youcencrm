import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api/error-response'
import { TABLES } from '@/lib/supabase/tables'
import { V2_TABLES } from '@/lib/v2/tables'
import { kstYmd, lastNDays } from '@/lib/v2/dates'
import {
  authedContext,
  forbidden,
  handleRouteError,
  isAdminRole,
  isMissingTableError,
  loadStaff,
  loadTargets,
  videoCountsByUserAndDay
} from '@/lib/v2/server'
import { sampleWorkload } from '@/lib/v2/sample-data'
import { isInProgressStage, isLateItem, type AttendanceLite, type Stage, type WorkloadPayload, type WorkloadRow } from '@/lib/v2/types'

// 관리자: 담당자별 오늘 목표/완료/진행/지연/근태 + 최근 7일 등록 추이
export async function GET(request: Request) {
  try {
    const { supabaseAdmin, isAdmin } = await authedContext(request)
    if (!isAdmin) return forbidden()

    const today = kstYmd()
    const days = lastNDays(7, today)

    const { data: itemRows, error: itemError } = await supabaseAdmin
      .from(V2_TABLES.productionItems)
      .select('assignee_user_id, stage, due_at')
      .neq('stage', 'done')
    if (itemError) {
      if (isMissingTableError(itemError)) return NextResponse.json(sampleWorkload())
      return errorResponse(itemError, '워크로드 조회 실패')
    }

    // 워크로드는 유튜버(직원) 기준. 관리자도 영상을 올리면 포함되지만 기본적으로는 직원 먼저.
    const staff = (await loadStaff(supabaseAdmin)).filter((s) => !isAdminRole(s.roleType || ''))
    const staffIds = staff.map((s) => s.id)

    const [targets, videoByDay, { data: attendanceRows }] = await Promise.all([
      loadTargets(supabaseAdmin, staffIds),
      videoCountsByUserAndDay(supabaseAdmin, days, staffIds),
      supabaseAdmin
        .from(TABLES.attendanceDays)
        .select('user_id, check_in_at, check_out_at, attendance_status')
        .eq('work_date', today)
        .in('user_id', staffIds.length > 0 ? staffIds : ['00000000-0000-0000-0000-000000000000'])
    ])

    const attendanceMap = new Map<string, AttendanceLite>()
    for (const row of (attendanceRows || []) as ({ user_id: string } & AttendanceLite)[]) {
      attendanceMap.set(row.user_id, { check_in_at: row.check_in_at, check_out_at: row.check_out_at, attendance_status: row.attendance_status })
    }

    const now = Date.now()
    const rows: WorkloadRow[] = staff.map((s) => {
      const mine = ((itemRows || []) as { assignee_user_id: string | null; stage: Stage; due_at: string | null }[]).filter(
        (item) => item.assignee_user_id === s.id
      )
      return {
        userId: s.id,
        name: s.name,
        target: targets[s.id],
        doneToday: videoByDay[s.id]?.[today] ?? 0,
        inProgress: mine.filter((item) => isInProgressStage(item.stage)).length,
        late: mine.filter((item) => isLateItem(item, now)).length,
        planning: mine.filter((item) => item.stage === 'planning').length,
        attendance: attendanceMap.get(s.id) || null,
        spark: days.map((date) => ({ date, count: videoByDay[s.id]?.[date] ?? 0 }))
      }
    })

    const payload: WorkloadPayload = { rows, today, days }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, '워크로드 조회 실패')
  }
}
