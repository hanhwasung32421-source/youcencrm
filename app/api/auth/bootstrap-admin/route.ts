import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const ADMIN_LOGIN_ID = 'admin'
const ADMIN_EMAIL = 'admin@youcencrm.local'
const ADMIN_REAL_PASSWORD = 'a1234-youcencrm'

export async function POST() {
  try {
    const supabaseAdmin = createSupabaseAdminClient()

    const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    let adminUser = listed.users.find((user) => user.email === ADMIN_EMAIL) || null

    if (!adminUser) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_REAL_PASSWORD,
        email_confirm: true,
        user_metadata: {
          login_id: ADMIN_LOGIN_ID,
          display_name: 'admin'
        }
      })

      if (createError || !created.user) {
        return NextResponse.json({ error: createError?.message || '기본 관리자 생성 실패' }, { status: 500 })
      }

      adminUser = created.user
    } else {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
        password: ADMIN_REAL_PASSWORD,
        email_confirm: true,
        user_metadata: {
          ...(adminUser.user_metadata || {}),
          login_id: ADMIN_LOGIN_ID,
          display_name: 'admin'
        }
      })

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    const { data: profile } = await supabaseAdmin
      .from('crm_users')
      .select('id')
      .eq('auth_user_id', adminUser.id)
      .maybeSingle()

    if (!profile) {
      const { error: insertProfileError } = await supabaseAdmin.from('crm_users').insert({
        auth_user_id: adminUser.id,
        email: ADMIN_EMAIL,
        name: 'admin',
        role_type: 'super_admin',
        employment_status: 'active'
      })

      if (insertProfileError) {
        return NextResponse.json({ error: insertProfileError.message }, { status: 500 })
      }
    } else {
      const { error: updateProfileError } = await supabaseAdmin
        .from('crm_users')
        .update({
          email: ADMIN_EMAIL,
          name: 'admin',
          role_type: 'super_admin',
          employment_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', adminUser.id)

      if (updateProfileError) {
        return NextResponse.json({ error: updateProfileError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      loginId: ADMIN_LOGIN_ID,
      loginEmail: ADMIN_EMAIL,
      loginPassword: ADMIN_REAL_PASSWORD
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '기본 관리자 준비 실패' }, { status: 500 })
  }
}
