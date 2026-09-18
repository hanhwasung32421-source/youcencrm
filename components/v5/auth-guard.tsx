'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/session/authed-fetch'
import { fetchMe } from '@/lib/session/me-client'
import { canAccessPath, getHomeHref } from '@/lib/v5/menu'

// V5(성장 실험 · 알고리즘 최적화 캔버스)는 메뉴 권한 테이블을 보지 않고 역할(role_type)만으로 접근을 가른다.
// super_admin/admin = 관리자, 그 외 = 직원. 로그인 안 된 사용자는 /v5/login 으로.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) {
          router.replace('/v5/login')
          return
        }

        let me: { roleType: string }
        try {
          me = await fetchMe(accessToken)
        } catch {
          router.replace('/v5/login')
          return
        }

        if (!canAccessPath(pathname, me.roleType)) {
          router.replace(getHomeHref(me.roleType))
          return
        }

        if (!cancelled) setReady(true)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '인증 확인 중 오류가 발생했습니다.')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (error) {
    return <div className="message-error">{error}</div>
  }

  if (!ready) {
    return null
  }

  return <>{children}</>
}
