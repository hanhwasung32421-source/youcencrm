'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { DEFAULT_ROLE_MENU_KEYS, MENU_DEFINITIONS } from '@/lib/menu/permissions'
import { clearMeCache, fetchMe } from '@/lib/session/me-client'
import { getAccessToken } from '@/lib/session/authed-fetch'

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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    const run = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return

        const data = await fetchMe(accessToken)
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
    clearMeCache()
    router.replace('/login')
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
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-section">
          <div className="sidebar-caption">workspace</div>
          <div className="sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
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
        <button className="button secondary sidebar-toggle" onClick={() => setSidebarOpen((prev) => !prev)}>
          {sidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
        </button>
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
