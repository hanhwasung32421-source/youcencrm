'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/session/authed-fetch'
import { fetchMe } from '@/lib/session/me-client'
import { isAdminRoleType, V2_HOME_HREF } from '@/lib/v2/menu'
import { V2SessionProvider, useV2Me, type V2Me } from './session-context'

// V2는 메뉴 권한 테이블을 쓰지 않는다. 역할(roleType)만으로 관리자/직원을 가른다.
// 로그인 안 됨 → /v2/login, 관리자 전용 화면에 직원 접근 → 제작 보드.
export function AuthGuard({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const router = useRouter()
  const [me, setMe] = useState<V2Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) {
          router.replace('/v2/login')
          return
        }

        let data: Awaited<ReturnType<typeof fetchMe>>
        try {
          data = await fetchMe(accessToken)
        } catch {
          router.replace('/v2/login')
          return
        }

        const isAdmin = isAdminRoleType(data.roleType)
        if (requireAdmin && !isAdmin) {
          router.replace(V2_HOME_HREF)
          return
        }

        if (!cancelled) {
          setMe({
            crmUserId: data.crmUserId,
            name: data.name,
            roleType: data.roleType,
            roleName: data.roleName || data.roleType,
            isAdmin
          })
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : '인증 확인 중 오류가 발생했습니다.')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [requireAdmin, router])

  if (error) {
    return <div className="message-error">{error}</div>
  }

  if (!me) {
    return null
  }

  return <V2SessionProvider me={me}>{children}</V2SessionProvider>
}

// 관리자 전용 페이지 본문을 감싼다. 직원이면 제작 보드로 돌려보낸다.
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const me = useV2Me()
  const router = useRouter()

  useEffect(() => {
    if (me.crmUserId && !me.isAdmin) router.replace(V2_HOME_HREF)
  }, [me.crmUserId, me.isAdmin, router])

  if (!me.isAdmin) return null
  return <>{children}</>
}
