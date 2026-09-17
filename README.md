# crm-web

유튜브센터 CRM 웹앱 (Next.js App Router).

전체 프로젝트 구조와 정책 문서는 저장소 루트의 [README.md](../README.md)와 [docs/crm/](../docs/crm/)를 참고하세요.

## 로컬 실행

```bash
npm install
cp .env.example .env   # 값 채우기
npm run dev
```

## 폴더 구조

```text
app/
  admin/            관리자 페이지 (page.tsx + 페이지 전용 폴더)
  creator/          유튜버 페이지
  api/              API 라우트 (도메인/액션별로 폴더 분리)
lib/
  supabase/         Supabase 클라이언트 3종 + 테이블명 상수(tables.ts)
  auth/             로그인 세션/권한 확인
  attendance/        근태 시간 계산 유틸
  menu/             역할별 메뉴 권한
  youtube/          유튜브 데이터 API 연동
components/         여러 페이지에서 재사용하는 공통 컴포넌트
```

테이블 이름을 바꾸거나 접두어를 바꿔야 하면 [lib/supabase/tables.ts](lib/supabase/tables.ts) 한 곳만 고치면 됩니다.

## 빌드/배포

```bash
npm run build
npm start
```

Vercel 배포 시 `.env`에 채운 값을 그대로 Environment Variables에 등록하세요.
