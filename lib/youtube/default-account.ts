import { DEFAULT_YOUTUBE_ACCOUNT_NAME, DEFAULT_YOUTUBE_API_KEY } from '@/lib/app-config'
import { TABLES } from '@/lib/supabase/tables'

const SELECT_FIELDS =
  'id, account_name, api_key, channel_id, channel_name, is_active, api_active, api_last_error, api_last_checked_at'

export async function ensureDefaultYoutubeAccount(supabaseAdmin: any) {
  const { data: existing, error } = await supabaseAdmin
    .from(TABLES.youtubeAccounts)
    .select(SELECT_FIELDS)
    .eq('account_name', DEFAULT_YOUTUBE_ACCOUNT_NAME)
    .maybeSingle()

  const hasFallbackKey = Boolean(DEFAULT_YOUTUBE_API_KEY)

  if (existing) {
    const currentApiKey = String(existing.api_key || '').trim()
    const needsActivation =
      hasFallbackKey && (currentApiKey !== DEFAULT_YOUTUBE_API_KEY || existing.is_active !== true || existing.api_active !== true)

    if (needsActivation) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from(TABLES.youtubeAccounts)
        .update({
          api_key: DEFAULT_YOUTUBE_API_KEY,
          is_active: true,
          api_active: true,
          api_last_error: null
        })
        .eq('id', existing.id)
        .select(SELECT_FIELDS)
        .single()
      if (updateError) throw updateError
      return updated
    }
    return existing
  }

  if (error && !String(error.message || '').toLowerCase().includes('0 rows')) {
    throw error
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from(TABLES.youtubeAccounts)
    .insert({
      account_name: DEFAULT_YOUTUBE_ACCOUNT_NAME,
      api_key: DEFAULT_YOUTUBE_API_KEY,
      channel_id: null,
      channel_name: null,
      is_active: true,
      api_active: hasFallbackKey,
      api_last_error: null,
      api_last_checked_at: hasFallbackKey ? new Date().toISOString() : null
    })
    .select(SELECT_FIELDS)
    .single()

  if (createError) throw createError
  return created
}
