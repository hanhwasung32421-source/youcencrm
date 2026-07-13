import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase-config'

export function createSupabaseBrowserClient() {
  const url = SUPABASE_URL
  const anon = SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Supabase 브라우저 환경변수가 설정되어 있지 않습니다.')
  }

  return createClient(url, anon)
}
