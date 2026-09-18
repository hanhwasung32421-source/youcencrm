import { NextResponse } from 'next/server'
import { EXPERIMENT_SELECT, experimentPatchSchema, mapExperiments, type ExperimentRow } from '@/lib/v5/experiments'
import { V5_TABLES } from '@/lib/v5/tables'
import { forbidden, getSession, handleRouteError, isMissingTableError, missingTableResponse, notFound, readJson } from '@/lib/v5/api'

// 캔버스 카드는 칸반에서 드래그로 상태만 바꾸는 경우가 잦으므로 부분 수정을 허용한다.
// 작성자 본인 또는 관리자만 수정/삭제할 수 있다.
async function loadOwnedExperiment(supabaseAdmin: Awaited<ReturnType<typeof getSession>>['supabaseAdmin'], id: string) {
  const { data, error } = await supabaseAdmin.from(V5_TABLES.growthExperiments).select('id, created_by').eq('id', id).maybeSingle()
  if (error) throw error
  return data as { id: string; created_by: string | null } | null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session

    const existing = await loadOwnedExperiment(supabaseAdmin, id)
    if (!existing) return notFound('실험 카드를 찾을 수 없습니다.')
    if (!isAdmin && existing.created_by !== profile.id) return forbidden('본인이 등록한 실험만 수정할 수 있습니다.')

    const input = experimentPatchSchema.parse(await readJson(request))
    if (input.endedOn && input.startedOn && input.endedOn < input.startedOn) {
      return NextResponse.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.dimensions) patch.dimensions = input.dimensions
    if (input.videoIds) patch.video_ids = input.videoIds
    if (input.hypothesis !== undefined) patch.hypothesis = input.hypothesis
    if (input.metricDefinition !== undefined) patch.metric_definition = input.metricDefinition
    if (input.startedOn) patch.started_on = input.startedOn
    if (input.endedOn !== undefined) patch.ended_on = input.endedOn || null
    if (input.status) patch.status = input.status
    if (input.effectSize !== undefined) patch.effect_size = input.effectSize ?? null
    if (input.nextAction !== undefined) patch.next_action = input.nextAction || null

    const { data, error } = await supabaseAdmin.from(V5_TABLES.growthExperiments).update(patch).eq('id', id).select(EXPERIMENT_SELECT).single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }

    const [item] = await mapExperiments(supabaseAdmin, [data as ExperimentRow])
    return NextResponse.json({ item })
  } catch (e) {
    return handleRouteError(e, '성장 실험 수정 실패')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session

    const existing = await loadOwnedExperiment(supabaseAdmin, id)
    if (!existing) return notFound('실험 카드를 찾을 수 없습니다.')
    if (!isAdmin && existing.created_by !== profile.id) return forbidden('본인이 등록한 실험만 삭제할 수 있습니다.')

    const { error } = await supabaseAdmin.from(V5_TABLES.growthExperiments).delete().eq('id', id)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '성장 실험 삭제 실패')
  }
}
