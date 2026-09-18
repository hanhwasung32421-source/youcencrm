'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { authedFetchJson, getAccessToken } from '@/lib/session/authed-fetch'
import { getKstYmd } from '@/lib/attendance/time'
import { Toast, useToast } from '@/components/toast'
import { VersionBadge } from '@/components/version-badge'

type AttendanceStatus = 'not_started' | 'present' | 'late' | 'vacation' | 'early_leave' | 'review_needed'

export function TopbarAttendanceControls({ version }: { version: string }) {
  const pathname = usePathname()
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

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void loadAttendanceStatus()
    })

    return () => {
      subscription.unsubscribe()
    }
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
