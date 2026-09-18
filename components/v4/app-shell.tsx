'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { DEFAULT_ROLE_MENU_KEYS, MENU_DEFINITIONS } from '@/lib/v4/menu'
import { clearMeCache, fetchMe } from '@/lib/session/me-client'
import { getAccessToken } from '@/lib/session/authed-fetch'

type Me = {
  name: string
  roleType: string
  roleName?: string
  allowedMenuKeys?: string[]
}

// 예전에는 페이지마다 <AuthGuard><AppShell title=...>를 따로 감쌌다. Next.js
// App Router에서는 라우트가 바뀌어도 같은 layout.tsx에 걸린 컴포넌트는 다시
// 마운트되지 않는데, 페이지 안에 있던 AppShell은 매 이동마다 새로 마운트되면서
// 세션 확인(getSession)과 프로필 조회(/api/auth/me)를 또 거쳤다. 사이드바/계정
// 영역만 담당하는 이 프레임을 app/admin/layout.tsx, app/creator/layout.tsx로
// 옮겨서 같은 구역 안에서는 한 번만 마운트되게 한다.
export function AppShellFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Me | null>(null)

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
    router.replace('/v4/login')
  }

  const effectiveRoleType = me?.roleType || (pathname.startsWith('/v4/admin') ? 'admin' : 'staff')
  const allowedMenuKeys =
    me?.allowedMenuKeys && me.allowedMenuKeys.length > 0
      ? me.allowedMenuKeys
      : DEFAULT_ROLE_MENU_KEYS[(effectiveRoleType as keyof typeof DEFAULT_ROLE_MENU_KEYS) || 'staff'] || []
  const navItems = MENU_DEFINITIONS.filter((menu) => allowedMenuKeys.includes(menu.key))

  return (
    <div className="workspace">
      <aside id="app-sidebar" className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-caption">workspace</div>
          <nav className="sidebar-nav" aria-label="주요 메뉴">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
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

      <section className="content-area">{children}</section>
    </div>
  )
}

// 페이지 제목/부제/작업공간 배지. AppShellFrame과 달리 페이지마다 내용이 달라서
// layout이 아니라 각 page.tsx가 직접 렌더링한다.
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/v4/admin')

  return (
    <div className="document-head">
      <div className="document-head-top">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        <div className="page-badge">{isAdmin ? '관리자 작업 공간' : '유튜버 작업 공간'}</div>
      </div>
    </div>
  )
}
