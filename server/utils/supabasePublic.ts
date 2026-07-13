import { createClient } from '@supabase/supabase-js'

export function getSupabasePublic() {
  const config = useRuntimeConfig()
  if (!config.public.supabaseUrl || !config.public.supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'SUPABASE_URL 또는 SUPABASE_ANON_KEY 가 설정되어 있지 않습니다.'
    })
  }
  return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
}

