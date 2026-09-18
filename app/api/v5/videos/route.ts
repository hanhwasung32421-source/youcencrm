import { NextResponse } from 'next/server'
import { getSession, handleRouteError, loadUserMap, loadVideoOptions } from '@/lib/v5/api'

// 실험 대상 영상 / 플레이북 예시 영상 선택용 드롭다운 데이터(팀 전체 최근 영상).
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin } = session
    const videos = await loadVideoOptions(supabaseAdmin)
    const userMap = await loadUserMap(supabaseAdmin, videos.map((v) => v.primary_owner_user_id))
    const items = videos.map((v) => ({ ...v, owner_name: v.primary_owner_user_id ? userMap.get(v.primary_owner_user_id) || null : null }))
    return NextResponse.json({ items })
  } catch (e) {
    return handleRouteError(e, '영상 목록 조회 실패')
  }
}
