'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Me = {
  name: string
  roleType: string
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
        setMe({ name: data.name, roleType: data.roleType })
      } catch {}
    }

    void run()
  }, [])

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isAdmin = me ? ['super_admin', 'admin'].includes(me.roleType) : pathname.startsWith('/admin')
  const navItems = isAdmin
    ? [
        { href: '/admin/dashboard', label: '대시보드' },
        { href: '/admin/users', label: '직급 관리' },
        { href: '/admin/attendance', label: '근태 관리' },
        { href: '/admin/youtube-accounts', label: '유튜브 계정' }
      ]
    : [
        { href: '/creator/dashboard', label: '대시보드' },
        { href: '/creator/videos', label: '영상 등록' }
      ]

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
          {me ? <div className="pill small">{me.name} · {me.roleType}</div> : null}
          <div className="stack" style={{ marginTop: 12 }}>
            <Link className="sidebar-link" href="/">
              <span>홈으로</span>
            </Link>
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
