'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { clearMeCache } from '@/lib/session/me-client'
import { getMenusForRole, groupMenus } from '@/lib/v2/menu'
import { useV2Me } from './session-context'

// V2 셸: HTS 터미널 느낌의 그룹형 사이드바. 세션은 AuthGuard가 컨텍스트로 넘겨준다.
export function AppShellFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const me = useV2Me()

  const groups = groupMenus(getMenusForRole(me.isAdmin))
  let index = 0

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    clearMeCache()
    router.replace('/v2/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="workspace">
      <aside id="app-sidebar" className="sidebar">
        <div className="sidebar-section v2-sidebar-brand">
          <div className="v2-brand-line">Production Ops</div>
          <div className="small muted" style={{ marginTop: 6 }}>
            콘텐츠 제작 파이프라인 · V2
          </div>
        </div>

        {groups.map((group) => (
          <div className="sidebar-section" key={group.group}>
            <div className="sidebar-caption">{group.group}</div>
            <nav className="sidebar-nav" aria-label={`${group.group} 메뉴`}>
              {group.items.map((item) => {
                index += 1
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    className={`sidebar-link ${active ? 'active' : ''}`}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={item.description}
                  >
                    <span>{item.label}</span>
                    <span className="v2-nav-index">{String(index).padStart(2, '0')}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        ))}

        <div className="sidebar-section">
          <div className="sidebar-caption">account</div>
          <div className="v2-account">
            <div className="v2-account-name">{me.name || '-'}</div>
            <div className="small muted">
              {me.roleName || me.roleType} · {me.isAdmin ? '관리자' : '직원'}
            </div>
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
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

// 페이지 제목/부제. 오른쪽에 역할 배지와(선택) 페이지 액션을 둔다.
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  const me = useV2Me()

  return (
    <div className="document-head">
      <div className="document-head-top">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {actions}
          <div className="page-badge">{me.isAdmin ? '관리자 · 운영 콘솔' : '직원 · 제작 콘솔'}</div>
        </div>
      </div>
    </div>
  )
}
