'use client'

import { AuthGuard } from '@/components/v3/auth-guard'
import { AppShellFrame } from '@/components/v3/app-shell'

// /v3/login, /v3/signup 을 제외한 모든 작업 화면이 이 레이아웃을 공유한다.
// 접근 제어는 AuthGuard가 역할(roleType)과 메뉴 audience로 판단한다.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
