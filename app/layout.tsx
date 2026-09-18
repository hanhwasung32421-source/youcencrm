import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BUILD_VERSION } from '@/lib/generated-version'
import { TopbarAttendanceControls } from '@/components/topbar-attendance-controls'
import { VersionBadge } from '@/components/version-badge'

// 메인 앱과 완전히 분리된 디자인 실험용 사본(v2~v5)으로 바로 이동하는
// 링크. 각 버전은 app/v{n}/, components/v{n}/, lib/v{n}/ 아래에 메인과
// 독립적으로 복사되어 있어 여기서 자유롭게 고쳐도 메인에는 영향이 없다.
const DESIGN_VERSIONS = ['v2', 'v3', 'v4', 'v5']

export const metadata: Metadata = {
  title: '여왕개미미디어 CRM',
  description: 'DB통계 CRM',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/apple-touch-icon.png'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="container topbar-inner">
              <div className="brand-wrap">
                <img className="brand-mark" src="/logo-ant.png" alt="여왕개미미디어" width={38} height={38} />
                <div>
                  <div className="brand">여왕개미미디어 CRM</div>
                  <div className="brand-sub">DB통계 CRM</div>
                </div>
              </div>
              <nav className="version-switcher" aria-label="디자인 버전 전환">
                {DESIGN_VERSIONS.map((v) => (
                  <Link key={v} className="version-switcher-link" href={`/${v}`}>
                    {v}
                  </Link>
                ))}
              </nav>
              <TopbarAttendanceControls version={BUILD_VERSION} />
            </div>
          </header>
          <main className="container page">{children}</main>
          <footer className="app-footer">
            <div className="container">
              <VersionBadge version={BUILD_VERSION} className="bottom-version" />
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
