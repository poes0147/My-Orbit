# 인증 화면 사전 렌더링 오류 수정

- 관련 ign8t: `6f8b68bb-fe87-43a6-8424-ceb4e5c0c62d`
- 증상: `/session`, `/dashboard`에서 Next.js 16.4.3 Cache Components의 `Date.now()` 사전 렌더링 오류 발생.
- 원인 범위: 공통 인증 조회가 사전 렌더링 중 실행됨. Supabase Auth의 세션 처리에는 현재 시각을 사용하는 코드가 있으며, 앱 레이아웃 자체에는 현재 시각 호출이 없음. 정확한 SDK 내부 호출 지점은 스택에서 식별되지 않음.
- 수정: `getWorkspaceContext` 시작에 설치된 Next.js 문서가 권장하는 `await io()` 추가. 인증 조회를 정적 셸에서 제외하고 기존 Suspense 로딩 화면으로 처리. 서버 사용자·역할 검증은 계속 수행.
- 확인: 수정 전 `/session` 오류 재현. 수정 후 로그인된 브라우저에서 `/session`, `/dashboard` 정상 렌더링 및 신규 동일 오류 없음. `npx tsc --noEmit`, 수정 파일 ESLint 통과. `npm run build -- --webpack` 통과(23개 페이지 생성).
- 빌드 최초 시도는 샌드박스의 Google Fonts DNS 및 파일 권한 제한으로 실패했으며, 권한 있는 실행에서 통과.
- 적용: 로컬만 적용. 커밋·푸시·Vercel 배포 미수행. 이번 수정에서 OAuth 재로그인이나 장기 세션 갱신은 재검증하지 않음.
- 다음 확인: Vercel 로그인 후 배포 주소에 유지되는지 Supabase URL Configuration과 실제 리디렉션을 대조.
