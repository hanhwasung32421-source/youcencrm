'use client'

import { AuthGuard } from '@/components/v4/auth-guard'
import { AppShellFrame } from '@/components/v4/app-shell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAdmin>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
