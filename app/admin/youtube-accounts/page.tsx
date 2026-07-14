'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'

export default function AdminYoutubeAccountsPage() {
  const router = useRouter()

  useEffect(() => {
    // 유튜브 계정 관리 메뉴는 삭제되었습니다. 기존 링크로 접근한 경우 대시보드로 이동합니다.
    router.replace('/admin/dashboard')
  }, [router])

  return (
    <AuthGuard requireAdmin>
      <AppShell title="유튜브 계정 관리" subtitle="이 메뉴는 삭제되었습니다. 관리자 대시보드로 이동합니다.">
        <div className="panel">
          <div className="empty-state">유튜브 계정 관리 메뉴가 삭제되었습니다.</div>
        </div>
      </AppShell>
    </AuthGuard>
  )
}

