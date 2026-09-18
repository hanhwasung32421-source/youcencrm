import { NextResponse } from 'next/server'
import { forbidden, getSession, handleRouteError, loadStaffUsers } from '@/lib/v5/api'

// 딜 담당자 선택용 직원 목록(관리자 전용). 기존 youtubeCRM_crm_users 를 읽기만 한다.
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const users = await loadStaffUsers(session.supabaseAdmin)
    return NextResponse.json({ items: users })
  } catch (e) {
    return handleRouteError(e, '직원 목록 조회 실패')
  }
}
