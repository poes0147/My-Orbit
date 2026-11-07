# 관리자 워크숍 코드 발급

ign8t 작업 `0bb8c87b-3c77-4be9-aebd-450325b43f71`. 백로그 제목에는 ‘강사’가 남지만 최신 상세 스펙은 관리자 전용으로 정정됐다.

- 관리자(admin)만 전체 워크숍 조회·발급·종료 가능. 강사와 참여자는 API·RLS 모두 차단한다. 권한은 `public.users.role`에서 조회한다.
- `/admin/workshops`: PC 사이드바+전체 표, 모바일 카드, 발급 폼·복사·큰 코드 표시·종료.
- `/admin/sessions`와 기존 `/instructor/sessions`는 관리자 권한으로 보호된 별칭이다. 기존 API 역시 관리자만 허용한다.
- 기존 DB `session_code`, `title`, `organization_name`, `created_by`, `max_capacity`, `expires_at`, `ACTIVE/COMPLETED`를 재사용한다.
- 기본 정원35, 기본24시간, 1~500명/1~168시간. 생성 후 기간 변경·재발급·삭제·재개는 이번 범위에서 제외한다.
- `crypto.randomInt` 기반 혼동 문자 제외 6자리 코드. UNIQUE 충돌만 지수 백오프로 최대5회 시도한다.
- 발급 API는201, 비로그인401, 비관리자403. 기존 camelCase 입력과 `organization_name/max_capacity/expires_at` 매핑을 지원한다. 기존 DB 필수 컬럼인 `title`은 발급 요청에도 필수다.
- 다른 관리자가 만든 세션도 관리자가 전체 조회하고 종료할 수 있다. 업데이트 컬럼 권한은 status만 허용하므로 소유자/코드/만료를 변경하지 못한다.

개발 DB 적용: `20261103130054_add_admin_role`, `20261103130938_admin_workshop_permissions`, `20261103131304_workshop_verify_capacity`. 최초 관리자 계정은 사용자 승인을 받아 지정했다. 계정 식별 정보는 소스에 저장하지 않는다.

실제 브라우저 발급·복사·참여·종료와 DB 역할 위조/정원/만료 검증을 통과했다. 검증 세션은 제거했다. 전체 기록은 [스택 재점검](../reviews/2026-11-03-stack-audit.md)을 참조한다. 웹 변경은 로컬이며 미커밋·미푸시·Vercel 미배포다.
