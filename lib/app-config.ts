export const SIGNUP_CHALLENGE_SECRET =
  process.env.SIGNUP_CHALLENGE_SECRET || 'queen-ant-media-crm-signup-secret'

// 운영 도메인 고정 (Supabase Magic Link/Confirm 링크가 localhost로 떨어지는 문제 방지)
export const APP_ORIGIN = process.env.APP_ORIGIN || 'https://youcencrm.vercel.app'

export const DEFAULT_YOUTUBE_ACCOUNT_NAME = process.env.DEFAULT_YOUTUBE_ACCOUNT_NAME || '개미들의 주식노트'

// 계정별 API 키를 아직 등록하지 않았을 때만 쓰는 폴백 키. 비워두면 기본 계정은
// 비활성 상태로 생성되고, 관리자가 유튜브 계정 페이지에서 직접 키를 등록해야 합니다.
export const DEFAULT_YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || ''
