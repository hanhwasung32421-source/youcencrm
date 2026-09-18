'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { clearMeCache, fetchMe } from '@/lib/session/me-client'
import { getAccessToken } from '@/lib/session/authed-fetch'
import { getMenusForRole, isAdminRoleType, type MenuDefinition } from '@/lib/v5/menu'

export type V5Me = {
  crmUserId: string
  name: string
  roleType: string
  roleName: string
  isAdmin: boolean
}

const MeContext = createContext<V5Me | null>(null)

// 페이지에서 현재 사용자(관리자 여부, crmUserId)를 읽을 때 쓴다.
export function useV5Me() {
  return useContext(MeContext)
}

// 사이드바 + 계정 영역. app/v5/(app)/layout.tsx 에서 한 번만 마운트된다.
export function AppShellFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<V5Me | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return
        const data = await fetchMe(accessToken)
        setMe({
          crmUserId: data.crmUserId,
          name: data.name,
          roleType: data.roleType,
          roleName: data.roleName || data.roleType,
          isAdmin: isAdminRoleType(data.roleType)
        })
      } catch {}
    }
    void run()
  }, [])

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    clearMeCache()
    router.replace('/v5/login')
  }

  const groups = useMemo(() => {
    const menus = getMenusForRole(me?.roleType)
    const map = new Map<string, MenuDefinition[]>()
    for (const menu of menus) {
      const list = map.get(menu.group) || []
      list.push(menu)
      map.set(menu.group, list)
    }
    return Array.from(map.entries())
  }, [me?.roleType])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <MeContext.Provider value={me}>
      <div className="workspace">
        <aside id="app-sidebar" className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-brand">
              <div className="sidebar-brand-mark">GL</div>
              <div>
                <div className="sidebar-brand-title">성장 실험 랩</div>
                <div className="sidebar-brand-sub">여왕개미미디어 V5</div>
              </div>
            </div>
            {groups.map(([group, menus]) => (
              <div className="sidebar-group" key={group}>
                <div className="sidebar-caption">{group}</div>
                <nav className="sidebar-nav" aria-label={group}>
                  {menus.map((item) => (
                    <Link
                      key={item.href}
                      className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      title={item.description}
                    >
                      <span className="sidebar-link-icon" aria-hidden>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-caption">account</div>
            {me ? (
              <div className="sidebar-account">
                <div className="sidebar-avatar">{me.name.slice(0, 1)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{me.name}</div>
                  <div className="small muted">{me.isAdmin ? '관리자' : '직원'} · {me.roleName}</div>
                </div>
              </div>
            ) : (
              <div className="small muted">계정 정보를 불러오는 중</div>
            )}
            <div className="stack" style={{ marginTop: 12 }}>
              <button className="button secondary sm" onClick={logout}>
                로그아웃
              </button>
            </div>
          </div>
        </aside>

        <section className="content-area">{children}</section>
      </div>
    </MeContext.Provider>
  )
}

// 페이지 제목/부제/작업공간 배지 + 우측 액션 슬롯. 각 page.tsx 가 맨 위에 렌더링한다.
export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const me = useV5Me()
  return (
    <div className="document-head">
      <div className="document-head-top">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        <div className="document-head-actions">
          {actions}
          <div className="page-badge">{me ? (me.isAdmin ? '관리자 작업 공간' : '직원 작업 공간') : '성장 실험 랩'}</div>
        </div>
      </div>
    </div>
  )
}
