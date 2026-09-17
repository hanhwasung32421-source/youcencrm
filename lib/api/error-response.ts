import { NextResponse } from 'next/server'

// Postgres/PostgREST 에러 메시지를 그대로 클라이언트에 돌려주면 테이블/컬럼/제약조건
// 이름 같은 스키마 정보가 노출된다. 실제 원인은 서버 로그(Vercel function logs)에만
// 남기고, 사용자에게는 한글 안내 메시지만 내려준다. 로컬 개발 중에는 원인을 바로
// 확인할 수 있도록 메시지 뒤에 원본을 덧붙인다.
export function errorResponse(error: unknown, fallbackMessage: string, status = 500) {
  console.error(fallbackMessage, error)
  const detail = process.env.NODE_ENV !== 'production' && error instanceof Error ? ` (${error.message})` : ''
  return NextResponse.json({ error: `${fallbackMessage}${detail}` }, { status })
}
