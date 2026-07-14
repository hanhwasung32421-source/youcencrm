import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { BUILTIN_ROLE_TYPES } from '@/lib/menu-permissions'

const createRoleSchema = z.object({
  accessToken: z.string().min(10),
  code: z.string().min(2).max(50),
  name: z.string().min(1).max(50)
})

function normalizeCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)
    const { data, error } = await supabaseAdmin.from('roles').select('code, name').order('created_at', { ascending: true })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ items: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '직급 목록 조회 실패' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = createRoleSchema.parse(await request.json())
    const { profile, supabaseAdmin } = await requireAdmin(body.accessToken)
    if (profile.role_type !== 'super_admin') {
      return NextResponse.json({ error: '총 관리자만 직급을 추가할 수 있습니다.' }, { status: 403 })
    }

    const code = normalizeCode(body.code)
    if (BUILTIN_ROLE_TYPES.includes(code as never)) {
      return NextResponse.json({ error: '기본 직급 코드는 추가할 수 없습니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('roles')
      .insert({
        code,
        name: body.name.trim()
      })
      .select('code, name')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || '직급 추가 실패' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, item: data })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    return NextResponse.json({ error: firstIssue?.message || e?.message || '직급 추가 실패' }, { status: 500 })
  }
}

