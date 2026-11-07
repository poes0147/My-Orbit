# 워크숍 참여 코드 및 세션 컨텍스트

기록일: 2026-11-02  
ign8t 작업: `a4162b9d-8950-4b69-9d57-a29fe0128bc6`  
상태: 구현 진행 중. 세션 발급 UI와 실제 코드가 없어 완전한 참여 흐름은 아직 검증되지 않음.

## 사용자 흐름

이전에 합의한 시작 흐름을 따라 회원이 Google 또는 Kakao로 로그인한 뒤 `/session`에서 코드를 입력한다. 기존 앱의 경로에 맞춰 스펙의 `/join`은 새로 만들지 않는다.

1. 한 칸씩 입력하는 6문자 입력란은 소문자를 대문자로 바꾸고, 다음 칸으로 포커스를 옮긴다. 코드 전체 붙여넣기와 방향키·Backspace 이동을 지원한다.
2. `POST /api/workshops/verify`가 로그인 사용자 요청을 확인하고 Supabase RPC에서 코드 형식·존재·시작·종료 상태를 확인한다.
3. 확인된 워크숍을 보여주고, 사용자가 참여를 확정하면 `POST /api/workshops/join`이 참가 등록 후 `/builder`로 이동시킨다.
4. `/builder`는 `src/proxy.ts`에서 현재 로그인 계정에 유효한 워크숍 컨텍스트가 있는지 확인한다. 없거나 종료된 경우 `/session`으로 보낸다.

## 데이터·접근 제어

- `public.workshop_sessions`: 고유한 대문자 6자리 코드, 제목, 기관, 상태, 정원, 시작·만료 시각.
- `public.workshop_participants`: 회원과 워크숍의 연결. 회원은 여러 워크숍에 참여할 수 있고 현재 작업 컨텍스트는 한 번에 하나다.
- 두 테이블 모두 RLS를 켰고 `anon`/`authenticated`의 직접 테이블 권한과 정책은 두지 않았다. 조회·참여는 필요한 결과만 반환하는 RPC로 제한한다.
- `private.workshop_code_attempts`: 회원별 15분당 최대 20회 코드 확인을 제한하고 오래된 시도를 정리한다.
- `verify_workshop_code`, `join_workshop_session`, `current_workshop_session_id`, `get_current_workshop_session`은 `SECURITY DEFINER`와 빈 `search_path`를 사용한다. 실행 권한은 `authenticated`만 가지며 함수 안에서 `auth.uid()`를 확인한다.
- 참가 등록은 워크숍 행을 잠그고 정원을 확인해 동시 참여 요청이 정원 초과를 만들지 않게 한다. 현재 활성 세션 코드는 한 계정에 하나로 제한한다.
- 현재 DB에는 사용자 프로필 테이블 외에 워크숍 세션이 0개다. 강사 발급 UI는 이 작업 범위 밖이므로 유효 코드가 발급될 때까지 정상 참여 성공을 확인할 수 없다.
- 아직 프로필·프로젝트 데이터 테이블은 없다. 해당 테이블이 추가될 때 RLS 조건에 현재 워크숍 ID를 적용해야 실제 레코드 단위 세션 격리가 완성된다.

## 구현 파일

- `supabase/migrations/20261102143430_workshop_sessions.sql`
- `supabase/migrations/20261102143705_workshop_session_supporting_indexes.sql`
- `src/lib/workshops/api.ts`
- `src/app/api/workshops/verify/route.ts`
- `src/app/api/workshops/join/route.ts`
- `src/components/session/session-code-form.tsx`
- `src/app/(workspace)/session/page.tsx`
- `src/proxy.ts`

## 확인 및 남은 작업

- 두 마이그레이션을 Supabase `my-orbit-dev` 프로젝트에 적용했고 테이블·컬럼·RLS 상태를 확인했다.
- 성능 advisor에서 외래 키 인덱스와 코드 시도 테이블 PK 항목은 수정했다.
- 보안 advisor의 `SECURITY DEFINER` 경고 4개는 인증된 사용자에게 최소 응답을 주기 위한 의도된 RPC 경계다. 함수별 `auth.uid()` 확인, 빈 `search_path`, 제한된 실행 권한을 적용했다. RLS 정책 없음 알림은 API 직접 접근 권한을 주지 않는 설계에 따른다.
- 현행 작업 지침에 따라 자동 테스트나 빌드는 실행하지 않았다.
- 유효 세션 코드 생성, 성공적인 참여 등록, 정원 초과, 만료 코드, 다른 계정·세션 차단은 아직 브라우저에서 확인하지 않았다. 이 작업의 최종 검토 전 강사용 세션 발급 기능 또는 승인된 테스트 세션이 필요하다.
- `supabase migration new` CLI는 npm 레지스트리 DNS 오류로 실행되지 않아 기존 타임스탬프 규칙에 맞춰 로컬 마이그레이션 파일을 작성하고 MCP로 적용했다.

## 2026-11-03 최신 보정

앞선 미검증·강사 발급 문구는 이전 이력이다. 최신 기준에서는 관리자만 코드를 발급한다. 관리자 발급201, 실제 로그인 계정의 코드 확인·빌더 입장·종료 후 차단을 브라우저에서 확인했다. verify도 정원 초과를 안내하며 join의 잠금/정원 검증은 유지한다. 역할 위조/강사·참여자 발급 차단 및 만료/정원 검증은 실제 개발 DB에서 롤백 테스트했다. 새 관리자 정책과 시험 기록은 ../reviews/2026-11-03-stack-audit.md를 따른다. Profile 등 후속 테이블의 데이터 격리는 해당 기능 구현 시 추가 검증해야 한다.
