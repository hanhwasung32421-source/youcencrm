import { NextResponse } from 'next/server'
import { EXPERIMENT_SELECT, experimentInputSchema, mapExperiments, type ExperimentRow } from '@/lib/v5/experiments'
import { SAMPLE_EXPERIMENTS } from '@/lib/v5/sample-data'
import { V5_TABLES } from '@/lib/v5/tables'
import { getSession, handleRouteError, isMissingTableError, missingTableResponse, readJson } from '@/lib/v5/api'

export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, isAdmin, profile } = session

    let q = supabaseAdmin
      .from(V5_TABLES.growthExperiments)
      .select(EXPERIMENT_SELECT)
      .order('started_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (!isAdmin) q = q.eq('created_by', profile.id)

    const { data, error } = await q
    if (error) {
      if (isMissingTableError(error)) {
        // 테이블이 없으면 소유권을 판단할 실데이터가 없으니 샘플을 그대로 보여준다.
        return NextResponse.json({ sample: true, items: SAMPLE_EXPERIMENTS })
      }
      throw error
    }

    const items = await mapExperiments(supabaseAdmin, (data || []) as ExperimentRow[])
    return NextResponse.json({ sample: false, items })
  } catch (e) {
    return handleRouteError(e, '성장 실험 목록 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile } = session

    const input = experimentInputSchema.parse(await readJson(request))
    if (input.endedOn && input.endedOn < input.startedOn) {
      return NextResponse.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.growthExperiments)
      .insert({
        dimensions: input.dimensions,
        video_ids: input.videoIds,
        hypothesis: input.hypothesis,
        metric_definition: input.metricDefinition,
        started_on: input.startedOn,
        ended_on: input.endedOn || null,
        status: input.status,
        effect_size: input.effectSize ?? null,
        next_action: input.nextAction || null,
        created_by: profile.id
      })
      .select(EXPERIMENT_SELECT)
      .single()

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }

    const [item] = await mapExperiments(supabaseAdmin, [data as ExperimentRow])
    return NextResponse.json({ item })
  } catch (e) {
    return handleRouteError(e, '성장 실험 등록 실패')
  }
}
