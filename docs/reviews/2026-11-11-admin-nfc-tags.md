# 관리자 NFC 태그 관리 — 구현 및 검증

## 범위
관리자 `/admin/nfc-tags`에서 개별 발급, 전체 목록·등록/활성 상태, NFC URL·등록 링크·일회용 코드 복사. 기존 등록/명함/SNS 스위칭 연결. 대량 발급·삭제·소유권 변경·직접 NFC 쓰기는 제외.

- ign8t task: `127c0cc2-7c93-40b8-84cd-e51b1a781ef1`
- 상세 스펙: `6f9d2f52-5512-4f84-b507-813275918376` (승인된 56 Sparks 사용)
- 기존 계약 우선: 32자리 태그/코드, `claim_code_hash`, `mapped_at`, `owner_id` 유지. 생성 스펙의 6/8자리 예시·중복 컬럼·전달받은 관리자 ID 기반 권한 검사는 채택하지 않음.

## 실제 확인
- `node --test scripts/test-admin-access.mjs scripts/test-admin-nfc-api.mjs scripts/test-admin-nfc.mjs scripts/test-database.mjs`: 8개 통과.
- `node node_modules/eslint/bin/eslint.js .`: 오류/경고 없음.
- `node node_modules/typescript/bin/tsc --noEmit`: 통과.
- `node node_modules/next/dist/bin/next build --webpack`: 통과. 최초 제한된 실행의 Windows EPERM 후 정상 권한에서 재실행.
- 실제 제품 컴포넌트·Route Handler·마이그레이션을 임시 PGlite에 연결한 `scripts/nfc-ui-server.mjs` 사용. OAuth와 Supabase HTTP 전송은 테스트 대체이며 실제 배포 로그인 검증이 아님.
- 발급→코드 복사→공개 프로필 없는 참여자 계정 등록→대시보드 HTTPS 링크 선택→고정 URL 302 및 목적지 확인.
- 1280px/320px 화면 렌더링, 가로 넘침 없음. 복사 성공 및 클립보드 거부 시 수동 복사 안내.
- 목록 실패→재시도→빈 목록, 등록 코드 확인 전 결과 닫기 비활성.
- 발급 응답을 서버 처리 후 중단→같은 요청 재확인: 요청 2회, 생성 태그 1개, 코드 재노출 없음.
- 브라우저 뒤로 가기·메뉴 이탈 취소 시 결과 유지, 결과 닫은 뒤 발급 버튼 키보드 포커스 복귀 확인.

## 독립 검토 반영
다른 검토자가 발견한 내부 메뉴 이동 시 코드 유실 위험을 수정. 링크 클릭 확인과 같은 URL의 임시 히스토리 항목으로 뒤로 가기 확인을 적용. 결과 닫기 후 포커스를 렌더링 다음 프레임에 복귀하도록 수정. 브라우저에서 두 동작 확인 완료.

## DB / 배포 상태
- 새 마이그레이션: `20261111141428_admin_nfc_tags.sql`
- 비공개 발급 요청 기록 테이블(코드 평문 없음), 관리자 전용 발급/목록 RPC. 공개 테이블의 SELECT 권한은 확대하지 않음.
- 기존 태그 행/소유권/목적지를 변경하는 SQL 없음. 신규 API는 세션 사용자와 users.role 확인, DB도 auth.uid로 재검사.
- 로컬 임시 DB에만 적용. 공유 Supabase dev/prod 및 Vercel에는 **미적용·미배포**.
- 로컬 Docker/Supabase 서버가 없어 CLI 전체 타입 재생성·Supabase Advisors는 미실행. 기존 타입 파일에 신규 RPC 반환 계약 반영; 실제 PostgreSQL 권한·마이그레이션 테스트 통과. 운영 반영 뒤 타입 재생성 및 Advisors 확인 필요.
- 실제 동시 PostgreSQL 연결 간 경합, 실제 Supabase OAuth/PostgREST, Next Router의 전체 배포 환경, iPhone 실물 쓰기/읽기는 미확인. 임시 DB는 직렬 연결이며 재시도 동작만 검증.
- 환경변수 추가 없음. `NEXT_PUBLIC_APP_URL`이 실제 사용할 HTTPS 주소인지 배포 전 확인.

## 다음 순서
dev PR 검토 → 신규 DB 마이그레이션 적용/타입 재생성·Advisors → 웹 배포 → 관리자 계정에서 태그 1개 발급 및 별도 테스트 계정 등록 → 실물 NFC에 고정 URL 기록.
