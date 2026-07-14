import { DEFAULT_YOUTUBE_ACCOUNT_NAME, DEFAULT_YOUTUBE_API_KEY } from '@/lib/app-config'

export async function ensureDefaultYoutubeAccount(supabaseAdmin: any) {
  const { data: existing, error } = await supabaseAdmin
    .from('youtube_accounts')
    .select('id, account_name, api_key, channel_id, channel_name, is_active, api_active, api_last_error, api_last_checked_at')
    .eq('account_name', DEFAULT_YOUTUBE_ACCOUNT_NAME)
    .maybeSingle()

  if (existing) {
    const currentApiKey = String(existing.api_key || '').trim()
    if (currentApiKey !== DEFAULT_YOUTUBE_API_KEY || existing.is_active !== true || existing.api_active !== true) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('youtube_accounts')
        .update({
          api_key: DEFAULT_YOUTUBE_API_KEY,
          is_active: true,
          api_active: true,
          api_last_error: null
        })
        .eq('id', existing.id)
        .select('id, account_name, api_key, channel_id, channel_name, is_active, api_active, api_last_error, api_last_checked_at')
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
    .from('youtube_accounts')
    .insert({
      account_name: DEFAULT_YOUTUBE_ACCOUNT_NAME,
      api_key: DEFAULT_YOUTUBE_API_KEY,
      channel_id: null,
      channel_name: null,
      is_active: true,
      api_active: true,
      api_last_error: null,
      api_last_checked_at: new Date().toISOString()
    })
    .select('id, account_name, api_key, channel_id, channel_name, is_active, api_active, api_last_error, api_last_checked_at')
    .single()

  if (createError) throw createError
  return created
}

