import { NextResponse } from 'next/server'
import { V5_TABLES } from '@/lib/v5/tables'
import { forbidden, getSession, handleRouteError, isMissingTableError, missingTableResponse, notFound } from '@/lib/v5/api'

type Params = { params: Promise<{ id: string }> }

// 관리자는 모든 기록, 직원은 본인이 쓴 기록만 삭제할 수 있다.
export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session
    const { id } = await params

    const { data: row, error: readError } = await supabaseAdmin.from(V5_TABLES.activities).select('id, created_by').eq('id', id).maybeSingle()
    if (readError) {
      if (isMissingTableError(readError)) return missingTableResponse()
      throw readError
    }
    if (!row) return notFound('기록을 찾을 수 없습니다.')
    if (!isAdmin && row.created_by !== profile.id) return forbidden('본인이 작성한 기록만 삭제할 수 있습니다.')

    const { error } = await supabaseAdmin.from(V5_TABLES.activities).delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '커뮤니케이션 로그 삭제 실패')
  }
}
