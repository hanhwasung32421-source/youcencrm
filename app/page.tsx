import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="stack">
      <div className="panel">
        <h1 className="page-title">유센 CRM 시작</h1>
        <p className="page-subtitle">
          이 화면이 보이면 새 프레임워크 기본 렌더링은 정상입니다. 이제 로그인, 회원가입, 관리자/유튜버 기능을 이어서 사용하면 됩니다.
        </p>
      </div>

      <div className="grid grid-2">
        <div className="panel stack">
          <div className="card-title">공개 화면</div>
          <Link className="button" href="/login">
            로그인
          </Link>
          <Link className="button secondary" href="/signup">
            회원가입
          </Link>
        </div>

        <div className="panel stack">
          <div className="card-title">바로 이동</div>
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

