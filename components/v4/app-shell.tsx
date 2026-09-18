'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { clearMeCache } from '@/lib/session/me-client'
import { LOGIN_HREF, findMenuByPath, getMenusForRole, groupMenus } from '@/lib/v4/menu'
import { useV4Me } from '@/components/v4/me-context'

// V4 사이드바 프레임. (workspace) 라우트 그룹 layout에서 한 번만 마운트된다.
// 메뉴는 역할(관리자/직원)로만 걸러지고, 그룹(개요/콘텐츠 분석/팀/실험)별로 묶어 보여준다.
export function AppShellFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { me, isAdmin } = useV4Me()

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    clearMeCache()
    router.replace(LOGIN_HREF)
  }

  const groups = groupMenus(getMenusForRole(me?.roleType))

  return (
    <div className="workspace">
      <aside id="app-sidebar" className="sidebar">
        <div className="sidebar-section">
          <div className="v4-sidebar-brand">
            <span className="v4-sidebar-brand-dot" />
            <div>
              <div className="v4-sidebar-brand-title">성장 · 성과 분석</div>
              <div className="v4-sidebar-brand-sub">Growth &amp; Performance</div>
            </div>
          </div>
          {groups.map((group) => (
            <nav className="sidebar-nav v4-nav-group" key={group.group} aria-label={group.group}>
              <div className="sidebar-caption">{group.group}</div>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    className={`sidebar-link ${active ? 'active' : ''}`}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={item.description}
                  >
                    <span>{item.label}</span>
                    {item.audience === 'admin' ? <span className="v4-nav-tag">관리자</span> : null}
                  </Link>
                )
              })}
            </nav>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-caption">account</div>
          {me ? (
            <div className="v4-account">
              <div className="v4-account-avatar">{me.name.slice(0, 1)}</div>
              <div>
                <div className="v4-account-name">{me.name}</div>
                <div className="v4-account-role">{isAdmin ? '관리자' : '직원'} · {me.roleName}</div>
              </div>
            </div>
          ) : null}
          <div className="stack" style={{ marginTop: 12 }}>
            <button className="button secondary" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-caption">note</div>
          <div className="sidebar-note small">
            조회수·반응·업로드 시점을 실제 영상 데이터로 분석합니다. {isAdmin ? '전체 팀' : '내 영상'} 기준으로 집계됩니다.
          </div>
        </div>
      </aside>

      <section className="content-area">{children}</section>
    </div>
  )
}

// 페이지 제목/부제/작업공간 배지 + 오른쪽 액션 슬롯. 각 page.tsx가 맨 위에 렌더링한다.
export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const pathname = usePathname()
  const { isAdmin } = useV4Me()
  const menu = findMenuByPath(pathname)

  return (
    <div className="document-head">
      <div className="document-head-top">
        <div>
          {menu ? <div className="v4-crumb">{menu.group} / {menu.label}</div> : null}
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        <div className="v4-head-actions">
          {actions}
          <div className="page-badge">{isAdmin ? '관리자 작업 공간' : '직원 작업 공간'}</div>
        </div>
      </div>
    </div>
  )
}
