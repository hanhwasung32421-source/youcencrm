import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { SAMPLE_PARTNERS, SAMPLE_DEALS } from '@/lib/v5/sample-data'
import { PARTNER_GRADES, PARTNER_STATUSES, PARTNER_TYPES, type Deal, type Partner } from '@/lib/v5/types'
import {
  badRequest,
  forbidden,
  getSession,
  handleRouteError,
  isMissingTableError,
  missingTableResponse,
  optionalText,
  readJson
} from '@/lib/v5/api'

// 파트너별 성사 금액/진행 딜 수를 붙인다.
function enrichPartners(partners: Partner[], deals: Pick<Deal, 'partner_id' | 'stage' | 'expected_amount'>[]) {
  return partners.map((p) => {
    const mine = deals.filter((d) => d.partner_id === p.id)
    return {
      ...p,
      won_amount: mine.filter((d) => d.stage === 'won').reduce((s, d) => s + (d.expected_amount || 0), 0),
      open_deal_count: mine.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length
    }
  })
}

export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session

    const { data: partners, error } = await supabaseAdmin
      .from(V5_TABLES.partners)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ sample: true, items: enrichPartners(SAMPLE_PARTNERS, SAMPLE_DEALS) })
      }
      throw error
    }

    const { data: deals } = await supabaseAdmin.from(V5_TABLES.deals).select('partner_id, stage, expected_amount')
    return NextResponse.json({ sample: false, items: enrichPartners((partners || []) as Partner[], (deals || []) as Deal[]) })
  } catch (e) {
    return handleRouteError(e, '파트너 목록 조회 실패')
  }
}

const partnerSchema = z.object({
  company_name: z.string().trim().min(1, '회사명을 입력해 주세요.').max(200),
  partner_type: z.enum(PARTNER_TYPES),
  grade: z.enum(PARTNER_GRADES),
  contact_name: optionalText,
  contact_email: optionalText,
  contact_phone: optionalText,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  status: z.enum(PARTNER_STATUSES).optional().default('active'),
  memo: optionalText
})

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin, profile } = session

    const body = partnerSchema.parse(await readJson(request))
    if (body.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contact_email)) {
      return badRequest('담당자 이메일 형식이 올바르지 않습니다.')
    }

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.partners)
      .insert({ ...body, created_by: profile.id })
      .select('*')
      .single()

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '파트너 등록 실패')
  }
}
