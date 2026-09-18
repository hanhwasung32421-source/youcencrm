'use client'

import { AuthGuard } from '@/components/v5/auth-guard'
import { AppShellFrame } from '@/components/v5/app-shell'

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
