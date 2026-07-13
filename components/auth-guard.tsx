'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export function AuthGuard({
  children,
  requireAdmin = false
}: {
  children: React.ReactNode
  requireAdmin?: boolean
}) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (!session?.access_token) {
          router.replace('/login')
          return
        }

        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })

        if (!res.ok) {
          router.replace('/login')
          return
        }

        const me = (await res.json()) as { roleType: string }
        if (requireAdmin && !['super_admin', 'admin'].includes(me.roleType)) {
          router.replace('/creator/dashboard')
          return
        }

        setReady(true)
      } catch (e: any) {
        setError(e?.message || '인증 확인 중 오류가 발생했습니다.')
      }
    }

    void run()
  }, [requireAdmin, router])

  if (error) {
    return <div className="message-error">{error}</div>
  }

  if (!ready) {
    return <div className="muted">접속 권한을 확인하는 중입니다...</div>
  }

  return <>{children}</>
}

