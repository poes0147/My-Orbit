# 로그인 버튼 무반응 수정

- 운영 Chromium에서 Google 버튼 클릭 시 `form-action 'self'` CSP 위반을 재현했다. GET 폼의 서버 303 응답 이후 외부 OAuth 이동이 차단됐다. 서버 응답만 확인하는 검사는 이 문제를 발견하지 못한다.
- 로그인 시작 컨트롤을 일반 `<a>` 링크로 변경했다. 서버 signin 경로, PKCE 쿠키, provider 검증 및 safeNext 처리는 유지한다. Next Link의 사전 요청이나 클라이언트 라우팅을 사용하지 않는다.
- CSP 허용 범위를 넓히거나 제거하지 않았다. DB·환경 변수 변경 없음.
- 로컬 프로덕션 빌드에서 실제 클릭으로 Google 계정 로그인 화면과 Kakao 계정 로그인 화면 도달 확인. 두 경우 CSP 오류 없음.
- 320px/1280px 가로 넘침 없음, 링크 높이 56px, dashboard 복귀 경로 유지 및 외부 next 입력의 session fallback 확인.
- `npm run lint`, `npm run build -- --webpack` 통과.
- 외부 계정 인증 자체 및 운영 저장·공개 E2E는 아직 미검증. 운영 반영 후 로그인하여 계속 확인해야 한다.
