// Supabase 접속 정보는 환경변수로만 관리합니다. (.env, Vercel 환경변수)
// 브라우저에서 필요한 URL/ANON_KEY는 NEXT_PUBLIC_ 접두어 이름도 함께 지원합니다.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

// 서버(API route)에서만 사용합니다. 절대 클라이언트 컴포넌트에서 import하지 마세요.
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
