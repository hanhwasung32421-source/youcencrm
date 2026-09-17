import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getBearerToken, requireAdmin } from '@/lib/auth/session'
import { BUILTIN_ROLE_TYPES } from '@/lib/menu/permissions'
import { TABLES } from '@/lib/supabase/tables'
import { errorResponse } from '@/lib/api/error-response'

const bodySchema = z.object({
  userId: z.string().uuid(),
  roleType: z.string().min(1)
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await requireAdmin(getBearerToken(request))
    const roleCode = body.roleType.trim()

    const { data: roleRow } = await supabaseAdmin
      .from(TABLES.roles)
      .select('code')
      .eq('code', roleCode)
      .maybeSingle()

    if (!roleRow) {
      return NextResponse.json({ error: '존재하지 않는 직급입니다.' }, { status: 400 })
    }

    const isBuiltin = BUILTIN_ROLE_TYPES.includes(roleCode as never)
    const nextBaseRoleType = isBuiltin ? roleCode : 'staff'

    const { error } = await supabaseAdmin
      .from(TABLES.crmUsers)
      .update({
        role_type: nextBaseRoleType,
        custom_role_code: isBuiltin ? null : roleCode,
        employment_status: roleCode === 'retired' ? 'inactive' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', body.userId)

    if (error) {
      return errorResponse(error, '직급 저장 실패')
    }

    await supabaseAdmin.from(TABLES.auditLogs).insert({
      actor_user_id: profile.id,
      action_type: 'change_role',
      target_type: 'crm_user',
      target_id: body.userId,
      diff_summary: { role_type: nextBaseRoleType, custom_role_code: isBuiltin ? null : roleCode }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return errorResponse(e, '직급 저장 실패')
  }
}
