import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { SAMPLE_PARTNERS, SAMPLE_RISK_ISSUES } from '@/lib/v5/sample-data'
import { RISK_SEVERITIES, RISK_STATUSES, type Partner, type RiskIssue } from '@/lib/v5/types'
import {
  forbidden,
  getSession,
  handleRouteError,
  isMissingTableError,
  loadUserMap,
  missingTableResponse,
  optionalText,
  readJson
} from '@/lib/v5/api'

// 관리자: 전체 이슈. 직원: 본인 영상에 연결된 이슈 + 본인이 등록한 이슈.
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session

    const { data: issues, error } = await supabaseAdmin
      .from(V5_TABLES.riskIssues)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({
          sample: true,
          items: SAMPLE_RISK_ISSUES,
          partners: SAMPLE_PARTNERS.map((p) => ({ id: p.id, company_name: p.company_name }))
        })
      }
      throw error
    }

    let rows = (issues || []) as RiskIssue[]
    const videoIds = Array.from(new Set(rows.map((r) => r.video_id).filter((v): v is string => Boolean(v))))
    const videoMap = new Map<string, { title: string | null; owner: string }>()
    if (videoIds.length > 0) {
      const { data: videos } = await supabaseAdmin.from(V5_TABLES.videos).select('id, title, stock_name, primary_owner_user_id').in('id', videoIds)
      for (const v of (videos || []) as Array<{ id: string; title: string | null; stock_name: string; primary_owner_user_id: string }>) {
        videoMap.set(v.id, { title: v.title || v.stock_name, owner: v.primary_owner_user_id })
      }
    }
    if (!isAdmin) {
      rows = rows.filter((r) => r.created_by === profile.id || (r.video_id && videoMap.get(r.video_id)?.owner === profile.id))
    }

    const [{ data: partners }, userMap] = await Promise.all([
      isAdmin
        ? supabaseAdmin.from(V5_TABLES.partners).select('id, company_name').order('company_name', { ascending: true })
        : Promise.resolve({ data: [] as Array<Pick<Partner, 'id' | 'company_name'>> }),
      loadUserMap(supabaseAdmin, rows.map((r) => r.created_by))
    ])
    const partnerRows = (partners || []) as Array<Pick<Partner, 'id' | 'company_name'>>
    // 직원 화면에서도 파트너 이름은 보여야 하므로 필요한 것만 추가 조회
    const partnerNameMap = new Map(partnerRows.map((p) => [p.id, p.company_name]))
    const missingPartnerIds = Array.from(new Set(rows.map((r) => r.partner_id).filter((id): id is string => Boolean(id) && !partnerNameMap.has(id as string))))
    if (missingPartnerIds.length > 0) {
      const { data: extra } = await supabaseAdmin.from(V5_TABLES.partners).select('id, company_name').in('id', missingPartnerIds)
      for (const p of (extra || []) as Array<Pick<Partner, 'id' | 'company_name'>>) partnerNameMap.set(p.id, p.company_name)
    }

    return NextResponse.json({
      sample: false,
      items: rows.map((r) => ({
        ...r,
        video_title: r.video_id ? videoMap.get(r.video_id)?.title || null : null,
        partner_name: r.partner_id ? partnerNameMap.get(r.partner_id) || null : null,
        author_name: r.created_by ? userMap.get(r.created_by) || null : null
      })),
      partners: partnerRows
    })
  } catch (e) {
    return handleRouteError(e, '리스크 이슈 조회 실패')
  }
}

const issueSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해 주세요.').max(200),
  video_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  partner_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  severity: z.enum(RISK_SEVERITIES).optional().default('medium'),
  status: z.enum(RISK_STATUSES).optional().default('open'),
  action_note: optionalText
})

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session
    const body = issueSchema.parse(await readJson(request))

    if (!isAdmin) {
      // 직원은 본인 영상에 대해서만 이슈를 올릴 수 있다(파트너 연결은 관리자 전용).
      if (!body.video_id) return forbidden('직원은 본인 영상을 선택해서 이슈를 등록해 주세요.')
      const { data: video } = await supabaseAdmin.from(V5_TABLES.videos).select('id, primary_owner_user_id').eq('id', body.video_id).maybeSingle()
      if (!video || video.primary_owner_user_id !== profile.id) return forbidden('본인 영상에만 이슈를 등록할 수 있습니다.')
      body.partner_id = null
    }

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.riskIssues)
      .insert({ ...body, created_by: profile.id })
      .select('*')
      .single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '리스크 이슈 등록 실패')
  }
}
