import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { BUILTIN_ROLE_TYPES } from '@/lib/menu-permissions'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  userId: z.string().uuid(),
  roleType: z.string().min(1)
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await requireAdmin(body.accessToken)
    const roleCode = body.roleType.trim()

    const { data: roleRow } = await supabaseAdmin
      .from('roles')
      .select('code')
      .eq('code', roleCode)
      .maybeSingle()

    if (!roleRow) {
      return NextResponse.json({ error: '존재하지 않는 직급입니다.' }, { status: 400 })
    }

    const isBuiltin = BUILTIN_ROLE_TYPES.includes(roleCode as never)
    const nextBaseRoleType = isBuiltin ? roleCode : 'staff'

    const { error } = await supabaseAdmin
      .from('crm_users')
      .update({
        role_type: nextBaseRoleType,
        custom_role_code: isBuiltin ? null : roleCode,
        employment_status: roleCode === 'retired' ? 'inactive' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', body.userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: profile.id,
      action_type: 'change_role',
      target_type: 'crm_user',
      target_id: body.userId,
      diff_summary: { role_type: nextBaseRoleType, custom_role_code: isBuiltin ? null : roleCode }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '직급 저장 실패' }, { status: 500 })
  }
}
