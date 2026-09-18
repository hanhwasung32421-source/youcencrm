'use client'

import { AuthGuard } from '@/components/v5/auth-guard'
import { AppShellFrame } from '@/components/v5/app-shell'

// 로그인/회원가입을 제외한 모든 V5 화면의 공통 틀. 역할 검사는 AuthGuard 가 경로별로 한다.
export default function V5AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
