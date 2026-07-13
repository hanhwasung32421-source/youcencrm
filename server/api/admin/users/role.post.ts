import { readBody } from 'h3'
import { z } from 'zod'
import { requireAdminByAccessToken } from '../../../utils/adminGuard'

const BodySchema = z.object({
  accessToken: z.string().min(10),
  userId: z.string().uuid(),
  roleType: z.enum(['super_admin', 'admin', 'general_manager', 'manager', 'assistant_manager', 'senior_staff', 'staff', 'retired'])
})

export default defineEventHandler(async (event) => {
  const body = BodySchema.parse(await readBody(event))
  const { profile, admin } = await requireAdminByAccessToken(body.accessToken)

  const { error } = await admin
    .from('crm_users')
    .update({
      role_type: body.roleType,
      employment_status: body.roleType === 'retired' ? 'inactive' : 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', body.userId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await admin.from('audit_logs').insert({
    actor_user_id: profile.id,
    action_type: 'change_role',
    target_type: 'crm_user',
    target_id: body.userId,
    diff_summary: { role_type: body.roleType }
  })

  return { ok: true }
})

