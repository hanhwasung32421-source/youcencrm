'use client'

import { AuthGuard } from '@/components/auth-guard'
import { AppShellFrame } from '@/components/app-shell'

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
