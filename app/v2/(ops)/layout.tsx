'use client'

import { AuthGuard } from '@/components/v2/auth-guard'
import { AppShellFrame } from '@/components/v2/app-shell'

// 로그인 뒤 보이는 모든 V2 화면의 공통 틀. 관리자 전용 페이지는 각자 <AdminOnly>로 한 번 더 막는다.
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
