'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export function TopbarActions() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const run = async () => {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { session }
      } = await supabase.auth.getSession()
      setVisible(Boolean(session?.access_token))
    }
    void run()
  }, [])

  const checkout = async () => {
    setLoading(true)
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
      alert('퇴근 처리 되었습니다. 오늘도 수고하셨습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <button className="button secondary" disabled={loading} onClick={checkout}>
      퇴근
    </button>
  )
}

