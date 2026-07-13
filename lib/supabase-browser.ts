import { createClient } from '@supabase/supabase-js'

export function createSupabaseBrowserClient() {
  const publicEnv =
    typeof window !== 'undefined'
      ? (
          window as typeof window & {
            __PUBLIC_ENV__?: {
              supabaseUrl?: string
              supabaseAnonKey?: string
            }
          }
        ).__PUBLIC_ENV__
      : undefined

  const url = publicEnv?.supabaseUrl
  const anon = publicEnv?.supabaseAnonKey

  if (!url || !anon) {
    throw new Error('Supabase 브라우저 환경변수가 설정되어 있지 않습니다.')
  }

  return createClient(url, anon)
}
