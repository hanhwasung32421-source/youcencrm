'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/session/authed-fetch'
import { getFirstAllowedHref, getMenuKeyByPath } from '@/lib/v5/menu'
import { fetchMe } from '@/lib/session/me-client'

export function AuthGuard({
  children,
  requireAdmin = false
}: {
  children: React.ReactNode
  requireAdmin?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        const accessToken = await getAccessToken()

        if (!accessToken) {
          router.replace('/v5/login')
          return
        }

        let me: { roleType: string; allowedMenuKeys?: string[] }
        try {
          me = await fetchMe(accessToken)
        } catch {
          router.replace('/v5/login')
          return
        }

        if (requireAdmin && !['super_admin', 'admin'].includes(me.roleType)) {
          router.replace('/v5/creator/dashboard')
          return
        }

        const currentMenuKey = getMenuKeyByPath(pathname)
        const allowedMenuKeys = me.allowedMenuKeys || []
        // admin_youtube_accounts는 메인과 공유하는 메뉴 권한 백엔드가 모르는
        // v5 전용 신규 메뉴라, requireAdmin 통과 여부(위에서 이미 확인)로만
        // 판단하고 역할별 메뉴 허용 목록 체크는 건너뛴다.
        const isMenuBypassed = currentMenuKey === 'admin_youtube_accounts'
        if (currentMenuKey && !isMenuBypassed && !allowedMenuKeys.includes(currentMenuKey)) {
          router.replace(getFirstAllowedHref(allowedMenuKeys, me.roleType))
          return
        }

        setReady(true)
      } catch (e: any) {
        setError(e?.message || '인증 확인 중 오류가 발생했습니다.')
      }
    }

    void run()
  }, [pathname, requireAdmin, router])

  if (error) {
    return <div className="message-error">{error}</div>
  }

  if (!ready) {
    return null
  }

  return <>{children}</>
}
