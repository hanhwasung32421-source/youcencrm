import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)

    const { data, error } = await supabaseAdmin
      .from('crm_users')
      .select('id, name, email, role_type, custom_role_code, employment_status, joined_at')
      .order('joined_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: roles } = await supabaseAdmin.from('roles').select('code, name')
    const roleNameMap = Object.fromEntries((roles || []).map((role) => [role.code, role.name]))

    return NextResponse.json({
      items: (data || []).map((item) => ({
        ...item,
        role_code: item.custom_role_code || item.role_type,
        role_name: roleNameMap[item.custom_role_code || item.role_type] || item.custom_role_code || item.role_type
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '직원 목록 조회 실패' }, { status: 500 })
  }
}
