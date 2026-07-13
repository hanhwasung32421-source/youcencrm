import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const config = useRuntimeConfig()

  if (!config.public.supabaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'SUPABASE_URL 이 설정되어 있지 않습니다.'
    })
  }
  if (!config.supabaseServiceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'SUPABASE_SERVICE_ROLE_KEY 가 설정되어 있지 않습니다.'
    })
  }

  return createClient(config.public.supabaseUrl, config.supabaseServiceRoleKey)
}

