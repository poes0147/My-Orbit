# AI 맞춤 후속 질문 — 구현 및 검증

ign8t task `637e7e08-8c0d-47ca-8bca-93e454ee430f`, spec `e7447d1c-4da2-4741-afbf-1186ef773253`. 56 Sparks 상세 스펙 생성 및 사용자 구현 승인.

## 구현
- 기존 builder 1·2단계에 선택형 후속 질문 패널 연결. 빈 경험도 시작 가능.
- 기존 OpenAI 설정으로 경험과 이전 답변에 맞는 질문을 한 번에 하나, 세션당 최대 3개 제안. 건너뛰기도 한 문항으로 계산.
- 본인 문답을 DB에 24시간 보관. 로그아웃 시 기존 wizard 저장소 정리 규칙이 이어하기 키도 삭제.
- 답변은 공백 제외 최소 5자/최대 500자. 번호별 답변 수정 시 이후 문답을 폐기하고 수정된 답변으로 다시 생성한다고 안내.
- 작성 중 답변이 있으면 검토 버튼을 막고 먼저 저장하도록 안내. 반영 전 원문 비교 및 직접 편집, 취소 시 기존 경험 유지.
- 확인 후 폼에 반영 → 기존 강점 분석·초안 생성으로 연결. profiles/project_items/기존 인터뷰 초안을 직접 변경하지 않음.
- revision 조건으로 동시 수정 차단. 대기 중 질문 재조회는 AI 재호출 없음. 동일 답변/반영 요청의 재전송 처리.
- 계정별 분당 5회 질문 생성, 출처·입력 크기·인증 검사. 실패 응답은 내용/키를 로그에 남기지 않음.

## 생성 스펙과 실제 계약 차이
- 가상의 WizardFormValues/step2 및 resume_documents.parsed_content를 추가하지 않음. 실제 Draft의 experience/situation/role/action/result와 사용자가 폼에 적용한 이력서 내용 재사용.
- 기존 모델 설정 유지. 모델 업그레이드/새 패키지 없음.
- 상충한 답변 500/600자, 최소2/5자, quota5/10회는 UX의 500자·공백 제외5자·계정별5회로 통일.
- 성과 수치는 필수가 아님. 최종 문안은 AI가 새 사실을 쓰는 대신 사용자 답변을 해당 필드에 그대로 덧붙임. 500자를 넘으면 사용자에게 편집을 요청하고 자동으로 자르지 않음.
- RECALL 답변은 상황에 덧붙이고 검토 화면에서 경험 이름 및 다른 필드를 직접 보완 가능. 기존 키워드·가치관·톤은 그대로 유지.
- 적용한 문답을 재개한 경우 저장된 확인 문안을 다시 보여주며 명시적으로 반영 가능. 원본 입력이 달라지면 새 문답 필요.

## DB
- CLI 생성 `20261116133132_ai_followup_sessions.sql`: ai_followup_sessions, private.followup_attempts, claim_followup_attempt, 5분 간격 만료 정리.
- 본인만 SELECT/INSERT/UPDATE/DELETE. 소유자·초기 입력·만료 시간 변경은 컬럼 권한으로 차단. 만료 즉시 조회·수정 불가.
- qa_history 최대3 DB 제약, 회원 삭제 cascade, 기본24h, 세션 revision CAS.
- 전체 마이그레이션을 disposable PGlite에서 적용하고 schema metadata에서 신규 타입 생성.
- 원격 적용 없음. 운영 데이터 변경 없음.

## 실행한 검증
- `node --import ./scripts/fixtures/resolve-ts.mjs --test scripts/test-followup.mjs scripts/test-followup-api.mjs scripts/test-followup-db.mjs`: 7개 통과. 계약 테스트는 구현 전 모듈 미존재로 실패 후 통과.
- 기존 강점 테스트를 함께 실행한 20개 모두 통과.
- 기존 CI 단위/DB 테스트 묶음 19개 통과, 실서버용 익명 프로젝트 검사1개 환경 조건 SKIP. 별도 builder-draft/rate-limit/workshop-code/resume-analysis(PDF 포함) 통과.
- 전체 ESLint, TypeScript, 최종 webpack production build(50 routes) 통과. git diff --check 통과.
- 실제 OpenAI 1회: 가상 카페 경험 → RESULT / “컵 방향을 바꾼 뒤 손님의 주문 번호 확인에 어떤 변화가 있었나요?” 반환. 실제 이력서 전송 없음.
- 실제 React 컴포넌트 격리 서버 320/1280px에서 가로 넘침 없음, 주요 버튼 높이46px. 답변→다음 질문→건너뛰기→Q1수정→후속 문답 초기화→중간 검토→취소 보존→확인 반영 테스트.
- 입력 중 검토 차단, 새로고침 이어하기, 원본 경험 변경 후 적용 차단, 생성503 안내/재시도 확인.
- 실제 ProfileWizard에 확인 답변 반영→다음 단계에서 역할 입력 확인→새로고침 복원 확인.
- 브라우저의 인증/HTTP는 fixture. 실제 SQL 권한은 별도 PGlite, 실제 모델은 별도 유료 호출 검증. 실제 로그인된 원격 DB 전체 흐름이라고 주장하지 않음.
- 독립 코드 리뷰 P2 두 건(오래된 답변 접근 불가, 검토 시 미저장 답변 누락)을 수정하고 브라우저 회귀 확인.

## 남은 검증
- Supabase local advisors는 Docker DB가 없어 127.0.0.1:54322 연결 실패. 원격 적용 후 advisors 실행 필요.
- 실제 로그인 계정 HTTP→Supabase→AI→초안 생성/공개 전체 연결은 배포 후 확인 필요.
- 계정당5회는 서버 강제지만 모델 지연/문맥 품질은 실제 워크숍에서 관찰 필요. AI 질문의 사실 전제/유도 여부는 프롬프트와 구조 검증만으로 완전 보장하지 않음.
- 미커밋/미푸시/미배포. 다음은 dev PR → DB 적용 → 배포 및 사용자 확인. 색상 연결/포트폴리오 확장 제외.
