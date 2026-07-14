import { NextResponse } from 'next/server'

// 유튜브 계정 관리 메뉴는 삭제되었습니다.
// (이전 경로로 호출되는 경우를 위해 명시적으로 410을 반환합니다.)

export async function GET() {
  return NextResponse.json({ error: '유튜브 계정 관리 기능이 삭제되었습니다.' }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ error: '유튜브 계정 관리 기능이 삭제되었습니다.' }, { status: 410 })
}

