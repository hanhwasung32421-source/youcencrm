import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { SAMPLE_CONTRACTS, SAMPLE_DEALS, SAMPLE_PARTNERS } from '@/lib/v5/sample-data'
import { CONTRACT_STATUSES, type Contract, type Deal, type Partner } from '@/lib/v5/types'
import {
  amountSchema,
  badRequest,
  forbidden,
  getSession,
  handleRouteError,
  isMissingTableError,
  missingTableResponse,
  optionalText,
  readJson,
  ymdSchema
} from '@/lib/v5/api'

export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session

    const { data: contracts, error } = await supabaseAdmin
      .from(V5_TABLES.contracts)
      .select('*')
      .order('ends_on', { ascending: true })

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({
          sample: true,
          items: SAMPLE_CONTRACTS,
          partners: SAMPLE_PARTNERS.map((p) => ({ id: p.id, company_name: p.company_name })),
          deals: SAMPLE_DEALS.map((d) => ({ id: d.id, partner_id: d.partner_id, campaign_name: d.campaign_name, expected_amount: d.expected_amount }))
        })
      }
      throw error
    }

    const [{ data: partners }, { data: deals }] = await Promise.all([
      supabaseAdmin.from(V5_TABLES.partners).select('id, company_name').order('company_name', { ascending: true }),
      supabaseAdmin.from(V5_TABLES.deals).select('id, partner_id, campaign_name, expected_amount').order('updated_at', { ascending: false })
    ])
    const partnerRows = (partners || []) as Array<Pick<Partner, 'id' | 'company_name'>>

    return NextResponse.json({
      sample: false,
      items: ((contracts || []) as Contract[]).map((c) => ({
        ...c,
        partner_name: partnerRows.find((p) => p.id === c.partner_id)?.company_name || ''
      })),
      partners: partnerRows,
      deals: (deals || []) as Array<Pick<Deal, 'id' | 'partner_id' | 'campaign_name' | 'expected_amount'>>
    })
  } catch (e) {
    return handleRouteError(e, '계약 목록 조회 실패')
  }
}

const contractSchema = z.object({
  partner_id: z.string().min(1, '파트너를 선택해 주세요.'),
  deal_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  campaign_name: z.string().trim().min(1, '캠페인명을 입력해 주세요.').max(200),
  amount: amountSchema.optional().default(0),
  starts_on: ymdSchema,
  ends_on: ymdSchema,
  ad_disclosure: z.boolean().optional().default(true),
  deliverables: optionalText,
  status: z.enum(CONTRACT_STATUSES).optional().default('draft'),
  document_url: optionalText
})

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const body = contractSchema.parse(await readJson(request))
    if (body.ends_on < body.starts_on) return badRequest('종료일은 시작일 이후여야 합니다.')

    const { data, error } = await supabaseAdmin.from(V5_TABLES.contracts).insert(body).select('*').single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '계약 등록 실패')
  }
}
