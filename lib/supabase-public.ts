import { createClient } from '@supabase/supabase-js'

export function createSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Supabase 공개 환경변수가 설정되어 있지 않습니다.')
  }

  return createClient(url, anon)
}
