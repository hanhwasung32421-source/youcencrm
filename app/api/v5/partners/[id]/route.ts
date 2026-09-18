import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { SAMPLE_ACTIVITIES, SAMPLE_CONTRACTS, SAMPLE_DEALS, SAMPLE_PARTNERS } from '@/lib/v5/sample-data'
import { PARTNER_GRADES, PARTNER_STATUSES, PARTNER_TYPES, type Activity, type Contract, type Deal, type Partner } from '@/lib/v5/types'
import {
  forbidden,
  getSession,
  handleRouteError,
  isMissingTableError,
  loadUserMap,
  missingTableResponse,
  notFound,
  optionalText,
  readJson
} from '@/lib/v5/api'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const { id } = await params

    const { data: partner, error } = await supabaseAdmin.from(V5_TABLES.partners).select('*').eq('id', id).maybeSingle()

    if (error) {
      if (isMissingTableError(error)) {
        const sample = SAMPLE_PARTNERS.find((p) => p.id === id)
        if (!sample) return notFound('샘플 파트너를 찾을 수 없습니다.')
        const deals = SAMPLE_DEALS.filter((d) => d.partner_id === id)
        return NextResponse.json({
          sample: true,
          partner: {
            ...sample,
            won_amount: deals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.expected_amount, 0),
            open_deal_count: deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length
          },
          deals,
          contracts: SAMPLE_CONTRACTS.filter((c) => c.partner_id === id),
          activities: SAMPLE_ACTIVITIES.filter((a) => a.partner_id === id)
        })
      }
      throw error
    }
    if (!partner) return notFound('파트너를 찾을 수 없습니다.')

    const [{ data: deals }, { data: contracts }, { data: activities }] = await Promise.all([
      supabaseAdmin.from(V5_TABLES.deals).select('*').eq('partner_id', id).order('updated_at', { ascending: false }),
      supabaseAdmin.from(V5_TABLES.contracts).select('*').eq('partner_id', id).order('ends_on', { ascending: false }),
      supabaseAdmin.from(V5_TABLES.activities).select('*').eq('partner_id', id).order('occurred_at', { ascending: false }).limit(50)
    ])

    const dealRows = (deals || []) as Deal[]
    const activityRows = (activities || []) as Activity[]
    const userMap = await loadUserMap(supabaseAdmin, [
      ...dealRows.map((d) => d.owner_user_id),
      ...activityRows.map((a) => a.created_by)
    ])
    const p = partner as Partner

    return NextResponse.json({
      sample: false,
      partner: {
        ...p,
        won_amount: dealRows.filter((d) => d.stage === 'won').reduce((s, d) => s + (d.expected_amount || 0), 0),
        open_deal_count: dealRows.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length
      },
      deals: dealRows.map((d) => ({ ...d, partner_name: p.company_name, owner_name: d.owner_user_id ? userMap.get(d.owner_user_id) || null : null })),
      contracts: ((contracts || []) as Contract[]).map((c) => ({ ...c, partner_name: p.company_name })),
      activities: activityRows.map((a) => ({
        ...a,
        partner_name: p.company_name,
        deal_name: dealRows.find((d) => d.id === a.deal_id)?.campaign_name || null,
        author_name: a.created_by ? userMap.get(a.created_by) || null : null
      }))
    })
  } catch (e) {
    return handleRouteError(e, '파트너 상세 조회 실패')
  }
}

const patchSchema = z.object({
  company_name: z.string().trim().min(1).max(200).optional(),
  partner_type: z.enum(PARTNER_TYPES).optional(),
  grade: z.enum(PARTNER_GRADES).optional(),
  contact_name: optionalText,
  contact_email: optionalText,
  contact_phone: optionalText,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  status: z.enum(PARTNER_STATUSES).optional(),
  memo: optionalText
})

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const { id } = await params
    const body = patchSchema.parse(await readJson(request))

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.partners)
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    if (!data) return notFound('파트너를 찾을 수 없습니다.')
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '파트너 수정 실패')
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const { id } = await params

    const { error } = await supabaseAdmin.from(V5_TABLES.partners).delete().eq('id', id)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '파트너 삭제 실패')
  }
}
