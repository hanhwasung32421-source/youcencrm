'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { getKstYmd } from '@/lib/attendance'

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
  const [toastMessage, setToastMessage] = useState('')
  const [todayYmd, setTodayYmd] = useState(getKstYmd(new Date()))

  const loadAttendanceStatus = async () => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    const token = session?.access_token
    setVisible(Boolean(token))
    if (!token) return

    const res = await fetch('/api/attendance/status', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return

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
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

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

      const checkedInAt = data.checkedInAt || new Date().toISOString()
      setAttendanceStatus('present')
      setCheckInAt(checkedInAt)
      setCheckOutAt(null)
      setWorkedSeconds(0)
      setCheckoutAvailableAt(new Date(checkedInAt).getTime() + 5000)
      setToastMessage('출근처리 되었습니다.')
    } finally {
      setCheckingIn(false)
    }
  }

  const checkOut = async () => {
    setCheckingOut(true)
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
      setCheckoutAvailableAt(null)
      setToastMessage('퇴근처리 되었습니다.')
    } finally {
      setCheckingOut(false)
    }
  }

  if (!visible) {
    return <div className="top-version">{version}</div>
  }

  const showCheckInButton = !checkInAt
  const showCheckoutButton = Boolean(checkInAt && !checkOutAt)
  return (
    <>
      {toastMessage ? <div className="topbar-toast">{toastMessage}</div> : null}
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
        <div className="top-version">{version}</div>
      </div>
    </>
  )
}
