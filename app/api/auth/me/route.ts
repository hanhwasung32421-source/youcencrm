import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth/session'
import { getAllowedMenuKeysForRole } from '@/lib/menu/permissions'
import { TABLES } from '@/lib/supabase/tables'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 })
    }

    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)
    const effectiveRoleCode = profile.custom_role_code || profile.role_type

    const [allowedMenuKeys, { data: roleRow }] = await Promise.all([
      getAllowedMenuKeysForRole(supabaseAdmin, effectiveRoleCode),
      supabaseAdmin.from(TABLES.roles).select('name').eq('code', effectiveRoleCode).maybeSingle()
    ])

    return NextResponse.json({
      crmUserId: profile.id,
      roleType: profile.role_type,
      roleCode: effectiveRoleCode,
      roleName: roleRow?.name || effectiveRoleCode,
      name: profile.name,
      employmentStatus: profile.employment_status,
      allowedMenuKeys
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '프로필 조회 실패' }, { status: 401 })
  }
}
