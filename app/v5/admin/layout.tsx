'use client'

import { AuthGuard } from '@/components/v5/auth-guard'
import { AppShellFrame } from '@/components/v5/app-shell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAdmin>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
