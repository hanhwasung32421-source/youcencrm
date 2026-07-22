'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { formatWorkedHms } from '@/lib/attendance'
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
  const [checkingIn, setCheckingIn] = useState(false)
  const [attendanceMessage, setAttendanceMessage] = useState('')
  const [attendanceStatus, setAttendanceStatus] = useState<'not_started' | 'present' | 'late' | 'vacation' | 'early_leave' | 'review_needed'>('not_started')
  const [checkInAt, setCheckInAt] = useState<string | null>(null)
  const [checkOutAt, setCheckOutAt] = useState<string | null>(null)
  const [workedSeconds, setWorkedSeconds] = useState(0)

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

  useEffect(() => {
    const loadAttendanceStatus = async () => {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/attendance/status', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return
      setAttendanceStatus(data.attendanceStatus || 'not_started')
      setCheckInAt(data.checkInAt || null)
      setCheckOutAt(data.checkOutAt || null)
      setWorkedSeconds(Number(data.workedSeconds || 0))
    }

    void loadAttendanceStatus()
  }, [pathname])

  useEffect(() => {
    if (!checkInAt || checkOutAt) return
    const timer = window.setInterval(() => {
      const start = new Date(checkInAt)
      const seconds = Math.max(Math.floor((Date.now() - start.getTime()) / 1000), 0)
      setWorkedSeconds(seconds)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [checkInAt, checkOutAt])

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const checkIn = async () => {
    setCheckingIn(true)
    setAttendanceMessage('')
    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error || '출근 처리에 실패했습니다.')
        return
      }
      setAttendanceStatus('present')
      setCheckInAt(data.checkedInAt || new Date().toISOString())
      setCheckOutAt(null)
      setWorkedSeconds(0)
      setAttendanceMessage('출근 시간이 기록되었습니다.')
    } finally {
      setCheckingIn(false)
    }
  }

  const checkout = async () => {
    setCheckingOut(true)
    setAttendanceMessage('')
    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error || '퇴근 처리에 실패했습니다.')
        return
      }
      setCheckOutAt(data.checkedOutAt || new Date().toISOString())
      setWorkedSeconds(Number(data.workedSeconds || workedSeconds))
      setAttendanceMessage('퇴근 시간이 기록되었습니다.')
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
              {attendanceMessage ? <div className="message-success small" style={{ marginTop: 12 }}>{attendanceMessage}</div> : null}
            </div>
            <div className="attendance-top-actions">
              <div className="attendance-buttons">
                <button className="button success" disabled={checkingIn || Boolean(checkInAt)} onClick={checkIn}>
                  출근
                </button>
                <button className="button secondary" disabled={checkingOut || !checkInAt || Boolean(checkOutAt)} onClick={checkout}>
                  퇴근
                </button>
              </div>
              <div className="attendance-live-time">
                업무시간 {formatWorkedHms(workedSeconds)}
              </div>
            </div>
            <div className="page-badge">{isAdmin ? '관리자 작업 공간' : '유튜버 작업 공간'}</div>
          </div>
        </div>
        {children}
      </section>
    </div>
  )
}
