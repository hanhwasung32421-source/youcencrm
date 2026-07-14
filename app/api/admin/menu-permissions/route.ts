import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import {
  MENU_DEFINITIONS,
  loadRoleMenuMap
} from '@/lib/menu-permissions'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  roleType: z.string(),
  menuKeys: z.array(z.string())
})

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { profile, supabaseAdmin } = await requireAdmin(token)

    if (profile.role_type !== 'super_admin') {
      return NextResponse.json({ error: '총 관리자만 메뉴 권한을 관리할 수 있습니다.' }, { status: 403 })
    }

    const roleMenuMap = await loadRoleMenuMap(supabaseAdmin)
    const { data: roles } = await supabaseAdmin.from('roles').select('code, name').order('created_at', { ascending: true })
    return NextResponse.json({
      roles: roles || [],
      menus: MENU_DEFINITIONS,
      items: roleMenuMap
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '메뉴 권한 조회 실패' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await requireAdmin(body.accessToken)

    if (profile.role_type !== 'super_admin') {
      return NextResponse.json({ error: '총 관리자만 메뉴 권한을 저장할 수 있습니다.' }, { status: 403 })
    }

    const { data: roleRow } = await supabaseAdmin.from('roles').select('code').eq('code', body.roleType).maybeSingle()
    if (!roleRow) {
      return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 })
    }

    const validMenuKeys = MENU_DEFINITIONS.map((menu) => menu.key)
    const nextMenuKeys = body.menuKeys.filter((key) => validMenuKeys.includes(key as never))

    const rows = validMenuKeys.map((menuKey) => ({
      role_type: body.roleType,
      menu_key: menuKey,
      can_view: nextMenuKeys.includes(menuKey as never)
    }))

    const { error } = await supabaseAdmin.from('role_menu_permissions').upsert(rows, {
      onConflict: 'role_type,menu_key'
    })

    if (error) {
      return NextResponse.json(
        {
          error: error.message.includes('role_menu_permissions')
            ? '메뉴 권한 테이블이 없습니다. SQL 파일을 먼저 실행해 주세요.'
            : error.message
        },
        { status: 500 }
      )
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: profile.id,
      action_type: 'save_menu_permissions',
      target_type: 'role',
      target_id: body.roleType,
      diff_summary: {
        role_type: body.roleType,
        menu_keys: nextMenuKeys
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '메뉴 권한 저장 실패' }, { status: 500 })
  }
}
