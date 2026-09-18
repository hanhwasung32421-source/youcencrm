'use client'

import { AuthGuard } from '@/components/auth-guard'
import { AppShellFrame } from '@/components/app-shell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAdmin>
      <AppShellFrame>{children}</AppShellFrame>
    </AuthGuard>
  )
}
