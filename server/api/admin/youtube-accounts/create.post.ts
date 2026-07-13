import { readBody } from 'h3'
import { z } from 'zod'
import { requireAdminByAccessToken } from '../../../utils/adminGuard'

const BodySchema = z.object({
  accessToken: z.string().min(10),
  accountName: z.string().min(1),
  apiKey: z.string().min(10),
  channelId: z.string().optional().nullable(),
  channelName: z.string().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const body = BodySchema.parse(await readBody(event))
  const { profile, admin } = await requireAdminByAccessToken(body.accessToken)

  const { data, error } = await admin
    .from('youtube_accounts')
    .insert({
      account_name: body.accountName.trim(),
      api_key: body.apiKey.trim(),
      channel_id: body.channelId?.trim() || null,
      channel_name: body.channelName?.trim() || null,
      is_active: true
    })
    .select('id')
    .single()

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message || '유튜브 계정 저장에 실패했습니다.' })
  }

  await admin.from('audit_logs').insert({
    actor_user_id: profile.id,
    action_type: 'create_youtube_account',
    target_type: 'youtube_account',
    target_id: data.id,
    diff_summary: {
      account_name: body.accountName,
      channel_id: body.channelId || null
    }
  })

  return { ok: true, id: data.id }
})

