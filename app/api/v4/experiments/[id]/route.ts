import { NextResponse } from 'next/server'
import { z } from 'zod'
import { EXPERIMENT_SELECT, experimentInputSchema, mapExperiments, type ExperimentRow } from '@/lib/v4/experiments'
import { readJson, requireV4User, v4ErrorResponse, type V4Context } from '@/lib/v4/server'
import { MISSING_TABLE_MESSAGE, V4_TABLES, isMissingTableError } from '@/lib/v4/tables'

type Params = { params: Promise<{ id: string }> }

const idSchema = z.uuid()

// 본인이 만든 실험이거나 관리자일 때만 수정/삭제 가능
async function loadOwned(ctx: V4Context, id: string) {
  const { data, error } = await ctx.supabaseAdmin.from(V4_TABLES.contentExperiments).select(EXPERIMENT_SELECT).eq('id', id).maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return { missing: true as const }
    throw new Error(error.message)
  }
  if (!data) return { notFound: true as const }
  const row = data as ExperimentRow
  if (!ctx.isAdmin && row.created_by !== ctx.profile.id) return { forbidden: true as const }
  return { row }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await requireV4User(request)
    const { id } = await params
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: '잘못된 실험 ID 입니다.' }, { status: 400 })
    }
    const parsed = experimentInputSchema.partial().safeParse(await readJson(request))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || '입력값을 확인해 주세요.' }, { status: 400 })
    }

    const owned = await loadOwned(ctx, id)
    if ('missing' in owned) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 409 })
    if ('notFound' in owned) return NextResponse.json({ error: '실험을 찾을 수 없습니다.' }, { status: 404 })
    if ('forbidden' in owned) return NextResponse.json({ error: '본인이 등록한 실험만 수정할 수 있습니다.' }, { status: 403 })

    const input = parsed.data
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.videoId !== undefined) patch.video_id = input.videoId
    if (input.hypothesis !== undefined) patch.hypothesis = input.hypothesis
    if (input.variantA !== undefined) patch.variant_a = input.variantA
    if (input.variantB !== undefined) patch.variant_b = input.variantB
    if (input.metric !== undefined) patch.metric = input.metric
    if (input.startedOn !== undefined) patch.started_on = input.startedOn
    if (input.endedOn !== undefined) patch.ended_on = input.endedOn
    if (input.winner !== undefined) patch.winner = input.winner
    if (input.learning !== undefined) patch.learning = input.learning || null

    const startedOn = (patch.started_on as string | undefined) ?? owned.row.started_on
    const endedOn = (patch.ended_on as string | null | undefined) ?? owned.row.ended_on
    if (endedOn && startedOn && endedOn < startedOn) {
      return NextResponse.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 })
    }

    const { data, error } = await ctx.supabaseAdmin
      .from(V4_TABLES.contentExperiments)
      .update(patch)
      .eq('id', id)
      .select(EXPERIMENT_SELECT)
      .single()
    if (error) throw new Error(error.message)

    const [item] = await mapExperiments(ctx, [data as ExperimentRow])
    return NextResponse.json({ item })
  } catch (e) {
    return v4ErrorResponse(e, '실험 수정 실패')
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const ctx = await requireV4User(request)
    const { id } = await params
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: '잘못된 실험 ID 입니다.' }, { status: 400 })
    }
    const owned = await loadOwned(ctx, id)
    if ('missing' in owned) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 409 })
    if ('notFound' in owned) return NextResponse.json({ error: '실험을 찾을 수 없습니다.' }, { status: 404 })
    if ('forbidden' in owned) return NextResponse.json({ error: '본인이 등록한 실험만 삭제할 수 있습니다.' }, { status: 403 })

    const { error } = await ctx.supabaseAdmin.from(V4_TABLES.contentExperiments).delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return v4ErrorResponse(e, '실험 삭제 실패')
  }
}
