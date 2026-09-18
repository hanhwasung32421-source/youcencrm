'use client'

import { AuthGuard } from '@/components/v4/auth-guard'
import { AppShellFrame } from '@/components/v4/app-shell'

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
