import './globals.css'
import type { Metadata } from 'next'
import { BUILD_VERSION } from '@/lib/generated-version'

export const metadata: Metadata = {
  title: '유센 CRM',
  description: '유튜브 통계형 CRM'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="container topbar-inner">
              <div className="brand-wrap">
                <div className="brand-mark" />
                <div>
                  <div className="brand">유센 CRM</div>
                  <div className="brand-sub">유튜브 업로드 후 URL 입력 기반 통계형 CRM</div>
                </div>
              </div>
              <div className="row">
                <div className="pill small">ver. {BUILD_VERSION}</div>
                <div className="pill small">Document Workspace</div>
              </div>
            </div>
          </header>
          <main className="container page">{children}</main>
        </div>
      </body>
    </html>
  )
}
