import { NextResponse } from 'next/server'
import { mapPlaybook, PLAYBOOK_SELECT, type PlaybookRow } from '@/lib/v5/playbook'
import { V5_TABLES } from '@/lib/v5/tables'
import { getSession, handleRouteError, isMissingTableError, missingTableResponse, notFound } from '@/lib/v5/api'

// "이 패턴 사용함" — 새 영상을 등록할 때(또는 플레이북 목록에서 직접) 눌러 사용 횟수를 1 늘린다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(request)
    const { supabaseAdmin } = session

    const { data: existing, error: findError } = await supabaseAdmin.from(V5_TABLES.playbookEntries).select('id, usage_count').eq('id', id).maybeSingle()
    if (findError) {
      if (isMissingTableError(findError)) return missingTableResponse()
      throw findError
    }
    if (!existing) return notFound('플레이북 항목을 찾을 수 없습니다.')

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.playbookEntries)
      .update({ usage_count: (existing.usage_count || 0) + 1 })
      .eq('id', id)
      .select(PLAYBOOK_SELECT)
      .single()
    if (error) throw error

    const [item] = await mapPlaybook(supabaseAdmin, [data as PlaybookRow])
    return NextResponse.json({ item })
  } catch (e) {
    return handleRouteError(e, '패턴 사용 기록 실패')
  }
}
