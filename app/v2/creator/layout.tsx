'use client'

import { AuthGuard } from '@/components/v2/auth-guard'
import { AppShellFrame } from '@/components/v2/app-shell'

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
