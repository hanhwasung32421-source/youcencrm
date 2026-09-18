'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { clearMeCache } from '@/lib/session/me-client'
import { getVisibleMenus, MENU_GROUPS } from '@/lib/v3/menu'
import { useV3Me } from '@/components/v3/auth-guard'

// 사이드바(페이지 트리) + 계정 영역. app/v3/(workspace)/layout.tsx에서 한 번만 마운트된다.
export function AppShellFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const me = useV3Me()

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    clearMeCache()
    router.replace('/v3/login')
  }

  const menus = getVisibleMenus(me?.roleType)

  return (
    <div className="workspace">
      <aside id="app-sidebar" className="sidebar">
        <div className="sidebar-section">
          <div className="v3-sidebar-brand">
            <span>💬</span>
            <span>참여 · 성장</span>
          </div>
          <nav aria-label="주요 메뉴">
            {MENU_GROUPS.map((group) => {
              const items = menus.filter((menu) => menu.group === group.key)
              if (items.length === 0) return null
              return (
                <div className="v3-tree-group" key={group.key}>
                  <div className="v3-tree-caption">
                    <span>{group.icon}</span>
                    <span>{group.label}</span>
                  </div>
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                    return (
                      <Link
                        key={item.key}
                        className={`v3-tree-link ${active ? 'active' : ''}`}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={item.description}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </nav>

          <div className="v3-sidebar-account">
            {me ? (
              <div className="small">
                <div style={{ fontWeight: 600 }}>{me.name}</div>
                <div className="muted">{me.isAdmin ? '관리자' : '직원'} · {me.roleName}</div>
              </div>
            ) : null}
            <button className="button secondary" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      <section className="content-area">{children}</section>
    </div>
  )
}

// 문서 제목 영역. 페이지마다 아이콘/제목/부제가 다르므로 각 page.tsx가 직접 렌더링한다.
export function PageHeader({ icon, title, subtitle, actions }: { icon?: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  const me = useV3Me()

  return (
    <div className="document-head">
      <div className="document-head-top">
        <div style={{ minWidth: 0 }}>
          {icon ? <span className="v3-page-icon" aria-hidden>{icon}</span> : null}
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        <div className="row" style={{ flexShrink: 0 }}>
          {actions}
          <div className="page-badge">{me?.isAdmin ? '관리자 작업 공간' : '직원 작업 공간'}</div>
        </div>
      </div>
    </div>
  )
}
