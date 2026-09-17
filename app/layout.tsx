import './globals.css'
import type { Metadata } from 'next'
import { BUILD_VERSION } from '@/lib/generated-version'
import { TopbarAttendanceControls } from '@/components/topbar-attendance-controls'

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
              <TopbarAttendanceControls version={BUILD_VERSION} />
            </div>
          </header>
          <main className="container page">{children}</main>
        </div>
      </body>
    </html>
  )
}
