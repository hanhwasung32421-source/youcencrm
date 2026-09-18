import { NextResponse } from 'next/server'
import { EXPERIMENT_SELECT, experimentInputSchema, loadVideoOptions, mapExperiments, type ExperimentRow } from '@/lib/v4/experiments'
import { getSampleExperiments } from '@/lib/v4/sample-data'
import { readJson, requireV4User, v4ErrorResponse } from '@/lib/v4/server'
import { MISSING_TABLE_MESSAGE, V4_TABLES, isMissingTableError } from '@/lib/v4/tables'

export async function GET(request: Request) {
  try {
    const ctx = await requireV4User(request)
    let q = ctx.supabaseAdmin
      .from(V4_TABLES.contentExperiments)
      .select(EXPERIMENT_SELECT)
      .order('started_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (!ctx.isAdmin) q = q.eq('created_by', ctx.profile.id)

    const [{ data, error }, videoOptions] = await Promise.all([q, loadVideoOptions(ctx)])

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ sample: true, items: getSampleExperiments(), videoOptions, scope: ctx.isAdmin ? 'admin' : 'staff' })
      }
      throw new Error(error.message)
    }

    const items = await mapExperiments(ctx, (data || []) as ExperimentRow[])
    return NextResponse.json({ sample: false, items, videoOptions, scope: ctx.isAdmin ? 'admin' : 'staff' })
  } catch (e) {
    return v4ErrorResponse(e, '실험 목록 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireV4User(request)
    const parsed = experimentInputSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || '입력값을 확인해 주세요.' }, { status: 400 })
    }
    const input = parsed.data
    if (input.endedOn && input.endedOn < input.startedOn) {
      return NextResponse.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 })
    }

    const { data, error } = await ctx.supabaseAdmin
      .from(V4_TABLES.contentExperiments)
      .insert({
        video_id: input.videoId || null,
        hypothesis: input.hypothesis,
        variant_a: input.variantA,
        variant_b: input.variantB,
        metric: input.metric,
        started_on: input.startedOn,
        ended_on: input.endedOn || null,
        winner: input.winner || null,
        learning: input.learning || null,
        created_by: ctx.profile.id
      })
      .select(EXPERIMENT_SELECT)
      .single()

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 409 })
      }
      throw new Error(error.message)
    }

    const [item] = await mapExperiments(ctx, [data as ExperimentRow])
    return NextResponse.json({ item })
  } catch (e) {
    return v4ErrorResponse(e, '실험 등록 실패')
  }
}
