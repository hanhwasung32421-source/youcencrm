'use client'

import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { authedFetchJson, getAccessToken } from '@/lib/session/authed-fetch'
import { getKstYmd } from '@/lib/attendance/time'
import { Toast, useToast } from '@/components/toast'
import { VersionBadge } from '@/components/version-badge'

type AttendanceStatus = 'not_started' | 'present' | 'late' | 'vacation' | 'early_leave' | 'review_needed'

export function TopbarAttendanceControls({ version }: { version: string }) {
  const [visible, setVisible] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('not_started')
  const [checkInAt, setCheckInAt] = useState<string | null>(null)
  const [checkOutAt, setCheckOutAt] = useState<string | null>(null)
  const [workedSeconds, setWorkedSeconds] = useState(0)
  const [checkoutAvailableAt, setCheckoutAvailableAt] = useState<number | null>(null)
  const { toast, showSuccess, showError } = useToast()
  const [todayYmd, setTodayYmd] = useState(getKstYmd(new Date()))

  const loadAttendanceStatus = async () => {
    const token = await getAccessToken()
    setVisible(Boolean(token))
    if (!token) return

    const { ok, data } = await authedFetchJson<any>('/api/attendance/status')
    if (!ok) return

    setAttendanceStatus(data.attendanceStatus || 'not_started')
    setCheckInAt(data.checkInAt || null)
    setCheckOutAt(data.checkOutAt || null)
    setWorkedSeconds(Number(data.workedSeconds || 0))

    if (data.checkInAt && !data.checkOutAt) {
      const unlockAt = new Date(data.checkInAt).getTime() + 5000
      setCheckoutAvailableAt(unlockAt)
    } else {
      setCheckoutAvailableAt(null)
    }
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    void loadAttendanceStatus()

    // onAuthStateChange는 구독 직후 현재 세션으로 콜백을 한 번 더 부르는데
    // (INITIAL_SESSION), 그 값은 바로 위의 loadAttendanceStatus() 호출과
    // 똑같아서 /api/attendance/status가 매번 중복 호출됐다. 실제 로그인/
    // 로그아웃/토큰 갱신 때만 다시 불러오면 된다.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return
      void loadAttendanceStatus()
    })

    return () => {
      subscription.unsubscribe()
    }
    // 라우트가 바뀔 때마다 재구독+재조회할 이유가 없다(같은 사용자의 근태
    // 상태는 페이지 이동과 무관하다) — 마운트 시 한 번만 구독한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!checkInAt || checkOutAt) return
    const timer = window.setInterval(() => {
      const start = new Date(checkInAt)
      const seconds = Math.max(Math.floor((Date.now() - start.getTime()) / 1000), 0)
      setWorkedSeconds(seconds)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [checkInAt, checkOutAt])

  useEffect(() => {
    if (!checkoutAvailableAt) return
    if (Date.now() >= checkoutAvailableAt) return
    const timer = window.setInterval(() => {
      if (Date.now() >= checkoutAvailableAt) {
        window.clearInterval(timer)
        setCheckoutAvailableAt((prev) => prev)
      }
    }, 500)
    return () => window.clearInterval(timer)
  }, [checkoutAvailableAt])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextYmd = getKstYmd(new Date())
      if (nextYmd !== todayYmd) {
        setTodayYmd(nextYmd)
        void loadAttendanceStatus()
      }
    }, 60000)
    return () => window.clearInterval(timer)
  }, [todayYmd])

  const isCheckoutEnabled = useMemo(() => {
    if (!checkInAt || checkOutAt) return false
    if (!checkoutAvailableAt) return true
    return Date.now() >= checkoutAvailableAt
  }, [checkInAt, checkOutAt, checkoutAvailableAt, workedSeconds])

  const checkIn = async () => {
    setCheckingIn(true)
    try {
      const { ok, data } = await authedFetchJson<any>('/api/attendance/checkin', { method: 'POST' })
      if (!ok) {
        showError(data?.error || '출근 처리에 실패했습니다.')
        return
      }

      const checkedInAt = data.checkedInAt || new Date().toISOString()
      setAttendanceStatus('present')
      setCheckInAt(checkedInAt)
      setCheckOutAt(null)
      setWorkedSeconds(0)
      setCheckoutAvailableAt(new Date(checkedInAt).getTime() + 5000)
      showSuccess('출근처리 되었습니다.')
    } finally {
      setCheckingIn(false)
    }
  }

  const checkOut = async () => {
    setCheckingOut(true)
    try {
      const { ok, data } = await authedFetchJson<any>('/api/attendance/checkout', { method: 'POST' })
      if (!ok) {
        showError(data?.error || '퇴근 처리에 실패했습니다.')
        return
      }

      setCheckOutAt(data.checkedOutAt || new Date().toISOString())
      setWorkedSeconds(Number(data.workedSeconds || workedSeconds))
      setCheckoutAvailableAt(null)
      showSuccess('퇴근처리 되었습니다.')
    } finally {
      setCheckingOut(false)
    }
  }

  if (!visible) {
    return <VersionBadge version={version} className="top-version" />
  }

  const showCheckInButton = !checkInAt
  const showCheckoutButton = Boolean(checkInAt && !checkOutAt)
  return (
    <>
      <Toast toast={toast} />
      <div className="topbar-actions">
        {showCheckInButton ? (
          <button className="button success topbar-action-button" disabled={checkingIn} onClick={checkIn}>
            출근
          </button>
        ) : null}
        {showCheckoutButton ? (
          <button className="button secondary topbar-action-button" disabled={checkingOut || !isCheckoutEnabled} onClick={checkOut}>
            퇴근
          </button>
        ) : null}
        <VersionBadge version={version} className="top-version" />
      </div>
    </>
  )
}
