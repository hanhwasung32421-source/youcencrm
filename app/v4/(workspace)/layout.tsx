'use client'

import { AuthGuard } from '@/components/v4/auth-guard'
import { AppShellFrame } from '@/components/v4/app-shell'

// /v4/dashboard, /v4/ranking, ... 등 로그인 후 화면이 공유하는 프레임.
// 인증/역할 확인(AuthGuard) 뒤에 사이드바 프레임(AppShellFrame)을 한 번만 마운트한다.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
