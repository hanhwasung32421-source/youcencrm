import { createClient } from '@supabase/supabase-js'

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Supabase 브라우저 환경변수가 설정되어 있지 않습니다.')
  }

  return createClient(url, anon)
}

