import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { SAMPLE_ACTIVITIES, SAMPLE_DEALS, SAMPLE_PARTNERS } from '@/lib/v5/sample-data'
import { ACTIVITY_TYPES, type Activity, type Deal, type Partner } from '@/lib/v5/types'
import {
  badRequest,
  forbidden,
  getSession,
  handleRouteError,
  isMissingTableError,
  loadUserMap,
  missingTableResponse,
  optionalText,
  optionalYmd,
  readJson
} from '@/lib/v5/api'

// 관리자: 전체. 직원: 본인이 쓴 기록 + 본인이 담당하는 딜의 기록.
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session
    const url = new URL(request.url)
    const partnerId = url.searchParams.get('partnerId') || ''
    const dealId = url.searchParams.get('dealId') || ''
    const type = url.searchParams.get('type') || ''

    // 직원이 담당하는 딜(폼에서 선택 가능한 딜 범위이기도 하다)
    let dealQuery = supabaseAdmin.from(V5_TABLES.deals).select('id, partner_id, campaign_name, stage, owner_user_id').order('updated_at', { ascending: false })
    if (!isAdmin) dealQuery = dealQuery.eq('owner_user_id', profile.id)
    const { data: deals, error: dealError } = await dealQuery

    if (dealError) {
      if (isMissingTableError(dealError)) {
        let items = SAMPLE_ACTIVITIES
        if (partnerId) items = items.filter((a) => a.partner_id === partnerId)
        if (dealId) items = items.filter((a) => a.deal_id === dealId)
        if (type) items = items.filter((a) => a.activity_type === type)
        return NextResponse.json({
          sample: true,
          items,
          partners: SAMPLE_PARTNERS.map((p) => ({ id: p.id, company_name: p.company_name })),
          deals: SAMPLE_DEALS.map((d) => ({ id: d.id, partner_id: d.partner_id, campaign_name: d.campaign_name, stage: d.stage, owner_user_id: d.owner_user_id }))
        })
      }
      throw dealError
    }
    const dealRows = (deals || []) as Array<Pick<Deal, 'id' | 'partner_id' | 'campaign_name' | 'stage' | 'owner_user_id'>>

    let query = supabaseAdmin.from(V5_TABLES.activities).select('*').order('occurred_at', { ascending: false }).limit(300)
    if (!isAdmin) {
      const ownedIds = dealRows.map((d) => d.id)
      const clauses = [`created_by.eq.${profile.id}`]
      if (ownedIds.length > 0) clauses.push(`deal_id.in.(${ownedIds.join(',')})`)
      query = query.or(clauses.join(','))
    }
    if (partnerId) query = query.eq('partner_id', partnerId)
    if (dealId) query = query.eq('deal_id', dealId)
    if (type) query = query.eq('activity_type', type)
    const { data: activities, error } = await query

    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ sample: true, items: SAMPLE_ACTIVITIES, partners: [], deals: [] })
      throw error
    }

    const rows = (activities || []) as Activity[]
    const { data: partners } = await supabaseAdmin.from(V5_TABLES.partners).select('id, company_name').order('company_name', { ascending: true })
    const partnerRows = (partners || []) as Array<Pick<Partner, 'id' | 'company_name'>>
    const userMap = await loadUserMap(supabaseAdmin, rows.map((a) => a.created_by))

    // 직원은 본인 담당 딜에 속하지 않은 딜 이름은 알 수 없으므로 필요한 딜만 추가 조회
    const knownDealIds = new Set(dealRows.map((d) => d.id))
    const extraDealIds = Array.from(new Set(rows.map((a) => a.deal_id).filter((id): id is string => Boolean(id) && !knownDealIds.has(id as string))))
    const dealNameMap = new Map(dealRows.map((d) => [d.id, d.campaign_name]))
    if (extraDealIds.length > 0) {
      const { data: extra } = await supabaseAdmin.from(V5_TABLES.deals).select('id, campaign_name').in('id', extraDealIds)
      for (const d of (extra || []) as Array<{ id: string; campaign_name: string }>) dealNameMap.set(d.id, d.campaign_name)
    }

    return NextResponse.json({
      sample: false,
      items: rows.map((a) => ({
        ...a,
        partner_name: a.partner_id ? partnerRows.find((p) => p.id === a.partner_id)?.company_name || null : null,
        deal_name: a.deal_id ? dealNameMap.get(a.deal_id) || null : null,
        author_name: a.created_by ? userMap.get(a.created_by) || null : null
      })),
      partners: partnerRows,
      deals: dealRows
    })
  } catch (e) {
    return handleRouteError(e, '커뮤니케이션 로그 조회 실패')
  }
}

const activitySchema = z.object({
  partner_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  deal_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  activity_type: z.enum(ACTIVITY_TYPES),
  occurred_at: z.string().min(1, '일시를 입력해 주세요.'),
  summary: z.string().trim().min(1, '요약을 입력해 주세요.').max(2000),
  next_step: optionalText,
  next_step_on: optionalYmd
})

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session
    const body = activitySchema.parse(await readJson(request))
    const occurred = new Date(body.occurred_at)
    if (Number.isNaN(occurred.getTime())) return badRequest('일시 형식이 올바르지 않습니다.')

    let partnerId = body.partner_id || null
    if (body.deal_id) {
      const { data: deal, error } = await supabaseAdmin
        .from(V5_TABLES.deals)
        .select('id, partner_id, owner_user_id')
        .eq('id', body.deal_id)
        .maybeSingle()
      if (error) {
        if (isMissingTableError(error)) return missingTableResponse()
        throw error
      }
      if (!deal) return badRequest('연결하려는 딜을 찾을 수 없습니다.')
      if (!isAdmin && deal.owner_user_id !== profile.id) return forbidden('본인이 담당하는 딜에만 기록을 남길 수 있습니다.')
      if (!partnerId) partnerId = deal.partner_id
    } else if (!isAdmin) {
      return forbidden('직원은 본인이 담당하는 딜을 선택해서 기록해 주세요.')
    }
    if (!partnerId && !body.deal_id) return badRequest('파트너 또는 딜을 하나 이상 선택해 주세요.')

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.activities)
      .insert({
        partner_id: partnerId,
        deal_id: body.deal_id || null,
        activity_type: body.activity_type,
        occurred_at: occurred.toISOString(),
        summary: body.summary,
        next_step: body.next_step || null,
        next_step_on: body.next_step_on || null,
        created_by: profile.id
      })
      .select('*')
      .single()

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '커뮤니케이션 로그 등록 실패')
  }
}
