import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { SAMPLE_DEALS, SAMPLE_PARTNERS, SAMPLE_STAFF } from '@/lib/v5/sample-data'
import { DEAL_STAGES, type Deal, type Partner } from '@/lib/v5/types'
import {
  amountSchema,
  forbidden,
  getSession,
  handleRouteError,
  isMissingTableError,
  loadStaffUsers,
  loadUserMap,
  missingTableResponse,
  optionalText,
  optionalYmd,
  readJson
} from '@/lib/v5/api'

// 딜 목록 + 폼 셀렉트용 파트너/직원 목록을 한 번에 내려준다.
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session

    let query = supabaseAdmin.from(V5_TABLES.deals).select('*').order('updated_at', { ascending: false })
    if (!isAdmin) query = query.eq('owner_user_id', profile.id)
    const { data: deals, error } = await query

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({
          sample: true,
          items: SAMPLE_DEALS,
          partners: SAMPLE_PARTNERS.map((p) => ({ id: p.id, company_name: p.company_name, status: p.status })),
          users: SAMPLE_STAFF
        })
      }
      throw error
    }

    const dealRows = (deals || []) as Deal[]
    const [{ data: partners }, users] = await Promise.all([
      supabaseAdmin.from(V5_TABLES.partners).select('id, company_name, status').order('company_name', { ascending: true }),
      loadStaffUsers(supabaseAdmin)
    ])
    const partnerRows = (partners || []) as Array<Pick<Partner, 'id' | 'company_name' | 'status'>>
    const userMap = new Map(users.map((u) => [u.id, u.name]))
    // 퇴직자 등 목록에 없는 담당자 이름도 채워 준다.
    const missing = dealRows.map((d) => d.owner_user_id).filter((id): id is string => Boolean(id) && !userMap.has(id as string))
    if (missing.length > 0) {
      const extra = await loadUserMap(supabaseAdmin, missing)
      extra.forEach((name, id) => userMap.set(id, name))
    }

    return NextResponse.json({
      sample: false,
      items: dealRows.map((d) => ({
        ...d,
        partner_name: partnerRows.find((p) => p.id === d.partner_id)?.company_name || '',
        owner_name: d.owner_user_id ? userMap.get(d.owner_user_id) || null : null
      })),
      partners: partnerRows,
      users
    })
  } catch (e) {
    return handleRouteError(e, '딜 목록 조회 실패')
  }
}

const dealSchema = z.object({
  partner_id: z.string().min(1, '파트너를 선택해 주세요.'),
  campaign_name: z.string().trim().min(1, '캠페인명을 입력해 주세요.').max(200),
  stage: z.enum(DEAL_STAGES).optional().default('lead'),
  expected_amount: amountSchema.optional().default(0),
  owner_user_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  planned_publish_on: optionalYmd,
  next_action: optionalText,
  next_action_on: optionalYmd
})

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const body = dealSchema.parse(await readJson(request))

    const { data, error } = await supabaseAdmin.from(V5_TABLES.deals).insert(body).select('*').single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '딜 등록 실패')
  }
}
