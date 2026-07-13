import { createClient } from '@supabase/supabase-js'

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error('Supabase 관리자 환경변수가 설정되어 있지 않습니다.')
  }

  return createClient(url, serviceRole)
}
