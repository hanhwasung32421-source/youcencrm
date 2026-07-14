import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: '유튜브 계정 API 활성화 기능이 삭제되었습니다.' }, { status: 410 })
}

