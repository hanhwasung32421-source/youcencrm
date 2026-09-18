import { NextResponse } from 'next/server'
import { mapPlaybook, PLAYBOOK_SELECT, playbookInputSchema, type PlaybookRow } from '@/lib/v5/playbook'
import { SAMPLE_PLAYBOOK } from '@/lib/v5/sample-data'
import { V5_TABLES } from '@/lib/v5/tables'
import { getSession, handleRouteError, isMissingTableError, missingTableResponse, readJson } from '@/lib/v5/api'

// 팀 전체가 함께 만드는 라이브러리라 조회는 관리자/직원 구분 없이 전체 공개한다.
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin } = session

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.playbookEntries)
      .select(PLAYBOOK_SELECT)
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ sample: true, items: SAMPLE_PLAYBOOK, top: SAMPLE_PLAYBOOK.slice(0, 3) })
      }
      throw error
    }

    const items = await mapPlaybook(supabaseAdmin, (data || []) as PlaybookRow[])
    return NextResponse.json({ sample: false, items, top: items.slice(0, 3) })
  } catch (e) {
    return handleRouteError(e, '플레이북 목록 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile } = session

    const input = playbookInputSchema.parse(await readJson(request))

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.playbookEntries)
      .insert({
        title: input.title,
        when_to_use: input.whenToUse,
        example_video_id: input.exampleVideoId || null,
        tags: input.tags,
        effect_note: input.effectNote || null,
        usage_count: 0,
        created_by: profile.id
      })
      .select(PLAYBOOK_SELECT)
      .single()

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }

    const [item] = await mapPlaybook(supabaseAdmin, [data as PlaybookRow])
    return NextResponse.json({ item })
  } catch (e) {
    return handleRouteError(e, '플레이북 등록 실패')
  }
}
