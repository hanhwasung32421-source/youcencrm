import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getKstYmd } from '@/lib/attendance/time'
import { getSampleGoal } from '@/lib/v4/sample-data'
import { loadUsers, readJson, requireV4Admin, requireV4User, v4ErrorResponse } from '@/lib/v4/server'
import { MISSING_TABLE_MESSAGE, V4_TABLES, isMissingTableError } from '@/lib/v4/tables'

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, '월은 YYYY-MM 형식이어야 합니다.')

const goalInputSchema = z.object({
  month: monthSchema,
  userId: z.uuid().nullable().optional(),
  targetVideos: z.coerce.number().int().min(0).max(1000000),
  targetViews: z.coerce.number().int().min(0).max(1e12)
})

function mapGoal(row: any) {
  return {
    id: row.id as string,
    month: row.month as string,
    userId: (row.user_id as string | null) ?? null,
    targetVideos: Number(row.target_videos || 0),
    targetViews: Number(row.target_views || 0)
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await requireV4User(request)
    const url = new URL(request.url)
    const monthParam = url.searchParams.get('month')
    const month = monthSchema.safeParse(monthParam).success ? (monthParam as string) : getKstYmd().slice(0, 7)

    let q = ctx.supabaseAdmin
      .from(V4_TABLES.growthGoals)
      .select('id, month, user_id, target_videos, target_views')
      .eq('month', month)
      .order('created_at', { ascending: true })
    if (!ctx.isAdmin) q = q.or(`user_id.is.null,user_id.eq.${ctx.profile.id}`)

    const { data, error } = await q
    if (error) {
      if (isMissingTableError(error)) {
        const { staff } = await loadUsers(ctx.supabaseAdmin)
        return NextResponse.json({ sample: true, month, items: [getSampleGoal(month, staff.length)] })
      }
      throw new Error(error.message)
    }
    return NextResponse.json({ sample: false, month, items: (data || []).map(mapGoal) })
  } catch (e) {
    return v4ErrorResponse(e, '성장 목표 조회 실패')
  }
}

// 관리자만 목표를 저장한다. (month, user_id) 조합당 1건 — 있으면 update, 없으면 insert.
export async function POST(request: Request) {
  try {
    const ctx = await requireV4Admin(request)
    const parsed = goalInputSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || '입력값을 확인해 주세요.' }, { status: 400 })
    }
    const input = parsed.data
    const userId = input.userId || null

    let findQuery = ctx.supabaseAdmin.from(V4_TABLES.growthGoals).select('id').eq('month', input.month)
    findQuery = userId ? findQuery.eq('user_id', userId) : findQuery.is('user_id', null)
    const { data: existing, error: findError } = await findQuery.maybeSingle()
    if (findError) {
      if (isMissingTableError(findError)) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 409 })
      throw new Error(findError.message)
    }

    const payload = {
      month: input.month,
      user_id: userId,
      target_videos: input.targetVideos,
      target_views: input.targetViews,
      updated_at: new Date().toISOString()
    }
    const query = existing
      ? ctx.supabaseAdmin.from(V4_TABLES.growthGoals).update(payload).eq('id', existing.id)
      : ctx.supabaseAdmin.from(V4_TABLES.growthGoals).insert(payload)
    const { data, error } = await query.select('id, month, user_id, target_videos, target_views').single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ item: mapGoal(data) })
  } catch (e) {
    return v4ErrorResponse(e, '성장 목표 저장 실패')
  }
}
