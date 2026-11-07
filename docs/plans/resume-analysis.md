# 이력서 분석 → 입력폼 자동 채우기

ign8t 작업: `d2a04da0-f1a9-473d-b4c0-7a20b89dd12c`. 구현 및 로컬 검증 후 사용자 검토 대기. 웹 배포·커밋·PR은 아직 하지 않았다.

## 사용자가 확인할 것

1. [/builder](http://localhost:3000/builder)의 1단계에서 **이력서로 빠르게 채우기**를 연다.
2. PDF 또는 텍스트를 넣고 전송 안내에 동의한 뒤 분석한다.
3. 대표 경험·빈칸을 확인하고 수정한다. 취소하면 기존 입력은 유지된다.
4. 적용 후 역할·성과의 빈칸을 보완하고 기존 3단계를 진행한다. 가치관·말투는 직접 선택한다.

## 확정 범위

| 항목 | 동작 |
|---|---|
| PDF | 텍스트 PDF, 최대 **4MiB(4,194,304바이트)·5페이지**, OCR 제외 |
| 붙여넣기 | 앞뒤 공백 제외 50~8,000자 |
| 추출 | 경험명·키워드 최대 5개·상황·역할·행동·성과, 대표 경험 최대 3개 중 하나 선택 |
| 적용 | 미리보기에서 수정·취소, 기존 입력이 있으면 덮어쓰기 재확인 |
| AI | 서버 전용 Luna 설정 재사용, JSON Schema 검증, 없는 정보는 빈칸 |
| 제한 | 사용자 및 IP별 1분 3회, DB 트랜잭션으로 여러 서버가 같은 제한 사용 |
| 시간 | 본문 처리·추출·분석·저장 전체에 20초 중단 신호 |
| 보관 | 원본 PDF·추출 본문은 메모리에서만 처리. 분석 결과만 본인 전용 24시간 임시 보관 |
| 삭제 | 만료 즉시 RLS 조회 차단, 매분 만료 분석 결과 삭제. 적용 후 저장한 프로필은 별도 유지 |

**스펙 조정 승인:** 2026-11-04 사용자가 5MB → 4MB 변경을 선택했다. [Vercel 요청 본문 제한 4.5MB](https://vercel.com/docs/functions/limitations)에 multipart 여유를 둔 값이다. 원본을 별도 저장소에 업로드하지 않는다. ign8t 상태 메모에 이 승인을 기록한다.

## 구조와 개발 DB 적용

- `POST /api/builder/parse-resume`: 인증·Origin 검사 → DB 호출 제한 → 크기 검증 → PDF 추출/텍스트 검증 → AI 분석 → 본인 결과 저장.
- PDF는 별도 Node 프로세스에서 읽는다. 입력은 stdin, 결과는 stdout으로 전달하고, 중단 시 프로세스를 종료한다. Windows에서 네이티브 Canvas와 worker_threads를 함께 사용할 때 발생한 충돌을 피한다.
- `resume_documents`의 기존 `size_bytes` 필드를 유지하고 source_type/parsed_content/expires_at을 추가했다. 본인·유효기간 내 SELECT/UPDATE, 본인 DELETE만 허용한다. 클라이언트가 만료·소유자·분석 내용을 UPDATE할 수 없다.
- `resumes` 버킷은 비공개·4MiB로 예약했으며 이 구현에서는 업로드하지 않는다. INSERT 정책은 제거했다.
- 호출 제한 테이블은 비공개 스키마이며 직접 접근은 막았다. RPC는 auth.uid()만 사용하고 임의 사용자 ID를 받지 않는다. IP는 SHA-256 값만 잠시 보관한다. 오래된 제한 기록은 5분마다 정리한다.
- 적용 마이그레이션: `20261104133824_resume_analysis_lifecycle`, `20261104135706_resume_four_mb_limit`, `20261104140130_resume_analysis_quota`, `20261104140500_resume_quota_primary_key`. 개발 프로젝트 `vgbnowroatzftcsbowjc`에 적용, 생성 타입 갱신.

## 실제 확인 결과

- 합성 텍스트와 실제 PDF 바이트 업로드 → Luna 분석 → 결과 수정 → 덮어쓰기 확인 → 입력폼 적용 성공.
- 2개 경험 선택, 문서에 없는 성과 빈칸, 미리보기 취소 시 기존 입력 유지 확인.
- 적용 후 기존 가치관 '협업'·말투 'professional' 유지. 비어 있던 역할·배운 점을 직접 보완한 뒤 기존 AI 초안 생성 및 계정 저장까지 성공.
- 분석 성공 요청 약 8.6초(텍스트), 6.5초(PDF). 별도 사용량 측정 요청은 14.3초, Luna 입력 422·출력 157토큰. 모든 호출의 비용을 이 값으로 일반화하지 않는다.
- 비로그인 401, 짧은 텍스트 400, 4MiB 초과 PDF 400, DB 기반 4번째 호출 429 확인. 오류 검증 중 발생한 400/401/429 콘솔 메시지는 예상 결과.
- 분석 결과 PDF 1건·텍스트 2건은 원본 경로 NULL, 원본 Storage 객체 0개. 분석 만료 기본값 24시간 및 정리 작업 활성 상태 확인.
- 320px/1280px에서 업로드·미리보기 화면 스크린샷과 가로 넘침 없음 확인.
- `node scripts/test-resume-analysis.mjs`: 텍스트 경계·매핑·가치관/톤 제외·PDF 추출·빈 PDF·6페이지·과도한 텍스트·손상 PDF 검사 통과.
- `npx tsc --noEmit`, `npm run lint`, `npx next build --webpack` 통과. PDF 자식 프로세스와 네이티브 의존성의 빌드 추적 포함 확인.

## 미확인 및 검토 주의

- Docker가 없어 로컬 Supabase의 `supabase/tests/resume_analysis.sql`은 **미실행**. 두 계정·관리자/강사·익명 간 RLS, 만료 조회 차단을 실행 검증했다고 주장하지 않는다. 호스팅 DB에서 역할을 흉내 내는 테스트는 하지 않았다.
- 강제 제공자 장애/20초 타임아웃, 실제 24시간 경과 삭제, Linux/Vercel의 PDF 런타임 및 배포 URL 검증은 남았다. 원본은 업로드하지 않는다.
- [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)의 private.resume_analysis_attempts는 직접 접근 금지 목적이다. [인증 사용자 SECURITY DEFINER 실행 안내](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)의 새 RPC는 본인 호출 제한 소비만 허용하려는 의도다. 기존 다른 RPC·비밀번호 경고는 이번 작업 범위 밖이다.
- 스캔 PDF는 OCR하지 않는다. 텍스트 붙여넣기로 안내한다. AI 결과는 사실 검토 후 적용해야 한다.

## 다음 순위

사용자 이력서로 검토 → PR/배포 후 같은 흐름 재확인 → ign8t 다음 우선순위인 '나의 별' 조형 가이드 뷰어 검토.
