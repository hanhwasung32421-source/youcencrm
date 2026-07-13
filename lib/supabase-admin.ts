import { createClient } from '@supabase/supabase-js'
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '@/lib/supabase-config'

export function createSupabaseAdminClient() {
  const url = SUPABASE_URL
  const serviceRole = SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error('Supabase 관리자 환경변수가 설정되어 있지 않습니다.')
  }

  return createClient(url, serviceRole)
}
