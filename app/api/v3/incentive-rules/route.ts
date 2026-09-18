import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V3_TABLES } from '@/lib/v3/tables'
import { DEFAULT_INCENTIVE_RULE } from '@/lib/v3/finance'
import { authenticateAdmin, isMissingTableError, loadIncentiveRules, loadStaffUsers, missingTableResponse, readJson } from '@/lib/v3/server'

const upsertSchema = z.object({
  user_id: z.string().uuid(),
  base_pay: z.number().int().min(0).max(1_000_000_000),
  per_video: z.number().int().min(0).max(100_000_000),
  per_1k_views: z.number().int().min(0).max(100_000_000),
  longform_weight: z.number().min(0).max(100),
  shortform_weight: z.number().min(0).max(100)
})

// GET: 재직 직원 전체 + 각자의 규칙(없으면 기본값, ruleIsDefault=true)
export async function GET(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  try {
    const staff = await loadStaffUsers(supabaseAdmin)
    const { rules, sample } = await loadIncentiveRules(
      supabaseAdmin,
      staff.map((user) => user.id)
    )

    const rows = staff.map((user) => {
      const rule = rules.get(user.id)
      return {
        userId: user.id,
        name: user.name,
        roleType: user.role_type,
        ruleIsDefault: !rule,
        rule: rule
          ? {
              base_pay: rule.base_pay,
              per_video: rule.per_video,
              per_1k_views: rule.per_1k_views,
              longform_weight: rule.longform_weight,
              shortform_weight: rule.shortform_weight,
              updated_at: rule.updated_at || null
            }
          : { ...DEFAULT_INCENTIVE_RULE, updated_at: null }
      }
    })

    return NextResponse.json({ sample, defaults: DEFAULT_INCENTIVE_RULE, rows })
  } catch (e) {
    return errorResponse(e, '인센티브 규칙 조회에 실패했습니다.')
  }
}

// POST: 직원 1명의 규칙 upsert
export async function POST(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  const parsed = upsertSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '입력값을 확인해 주세요.' }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(V3_TABLES.incentiveRules)
      .upsert({ ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ rule: data })
  } catch (e) {
    return errorResponse(e, '인센티브 규칙 저장에 실패했습니다.')
  }
}
