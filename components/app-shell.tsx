'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { DEFAULT_ROLE_MENU_KEYS, MENU_DEFINITIONS } from '@/lib/menu-permissions'

type Me = {
  name: string
  roleType: string
  roleName?: string
  allowedMenuKeys?: string[]
}

export function AppShell({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Me | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { session }
        } = await supabase.auth.getSession()
        if (!session?.access_token) return

        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (!res.ok) return
        const data = (await res.json()) as Me & { crmUserId: string; employmentStatus: string }
        setMe({
          name: data.name,
          roleType: data.roleType,
          roleName: data.roleName || data.roleType,
          allowedMenuKeys: data.allowedMenuKeys || []
        })
      } catch {}
    }

    void run()
  }, [])

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const checkoutAndLogout = async () => {
    setCheckingOut(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        await logout()
        return
      }

      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error || '퇴근 처리에 실패했습니다.')
        return
      }

      await supabase.auth.signOut()
      router.replace('/login')
    } finally {
      setCheckingOut(false)
    }
  }

  const effectiveRoleType = me?.roleType || (pathname.startsWith('/admin') ? 'admin' : 'staff')
  const allowedMenuKeys =
    me?.allowedMenuKeys && me.allowedMenuKeys.length > 0
      ? me.allowedMenuKeys
      : DEFAULT_ROLE_MENU_KEYS[(effectiveRoleType as keyof typeof DEFAULT_ROLE_MENU_KEYS) || 'staff'] || []
  const isAdmin = pathname.startsWith('/admin') || ['super_admin', 'admin'].includes(effectiveRoleType)
  const navItems = MENU_DEFINITIONS.filter((menu) => allowedMenuKeys.includes(menu.key))

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-caption">workspace</div>
          <div className="sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                href={item.href}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-caption">account</div>
          {me ? <div className="pill small">{me.name} · {me.roleName || me.roleType}</div> : null}
          <div className="stack" style={{ marginTop: 12 }}>
            <button className="button secondary" disabled={checkingOut} onClick={checkoutAndLogout}>
              퇴근
            </button>
            <button className="button secondary" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-caption">note</div>
          <div className="sidebar-note small">
            문서 작업창처럼 정보 우선으로 정리된 화면입니다. 입력, 확인, 관리 흐름이 왼쪽 메뉴 기준으로 이어집니다.
          </div>
        </div>
      </aside>

      <section className="content-area">
        <div className="document-head">
          <div className="document-head-top">
            <div>
              <h1 className="page-title">{title}</h1>
              {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
            </div>
            <div className="page-badge">{isAdmin ? '관리자 작업 공간' : '유튜버 작업 공간'}</div>
          </div>
        </div>
        {children}
      </section>
    </div>
  )
}
