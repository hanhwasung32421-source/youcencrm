import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="stack">
      <div className="hero-grid">
        <div className="panel stack">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">정갈한 작업형 CRM</h2>
              <p className="panel-subtitle">
                업로드 후 URL 입력, 직급 관리, 근태 관리, 계정 관리가 한 화면 톤으로 이어지는 문서형 업무 공간입니다.
              </p>
            </div>
            <div className="page-badge">Ready</div>
          </div>

          <div className="doc-highlight">
            유튜버는 영상을 업로드한 뒤 계정을 선택하고 URL을 입력합니다. 관리자는 직원 직급, 근태, 유튜브 계정을 같은 작업 공간에서 관리합니다.
          </div>
        </div>

        <div className="panel soft stack">
          <div className="panel-title">바로 시작</div>
          <p className="panel-subtitle">처음 진입이라면 로그인 또는 회원가입부터 진행하세요.</p>
          <Link className="button" href="/login">
            로그인
          </Link>
          <Link className="button secondary" href="/signup">
            회원가입
          </Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="metric-card">
          <div className="card-title">유튜버 흐름</div>
          <div className="card-value">Upload → URL</div>
          <div className="card-meta">유튜브 업로드 후 CRM에 URL과 분류를 입력하면 메타데이터와 기본 통계가 자동 반영됩니다.</div>
        </div>

        <div className="metric-card">
          <div className="card-title">관리자 흐름</div>
          <div className="card-value">Role · Attendance</div>
          <div className="card-meta">직급 변경, 근태 등록, 유튜브 계정 추가를 모두 관리자 작업 공간에서 이어서 처리할 수 있습니다.</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">빠른 이동</div>
            <p className="panel-subtitle">권한별 화면도 바로 열 수 있습니다.</p>
          </div>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/creator/dashboard">
            유튜버 대시보드
          </Link>
          <Link className="button secondary" href="/admin/dashboard">
            관리자 대시보드
          </Link>
        </div>
      </div>
    </div>
  )
}
