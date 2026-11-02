<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## My Orbit 저장소 지침

### 프로젝트 기준

- 이 저장소는 취업·창업 준비 청년의 경험을 AI 기반 디지털 프로필과 NFC 클레이 오브제로 연결하는 모바일 우선 웹 서비스다. 주요 사용자는 워크숍 참여자와 강사이며, 공개 프로필 방문자는 로그인 없이 프로필을 확인한다.
- 합의된 제품 요구사항의 기준은 ign8t의 **My Orbit 마스터 스펙**과 선택된 작업의 최신 스펙이다. 코드와 스펙이 다르면 차이를 먼저 알리고, 추측으로 제품 동작을 정하지 않는다.
- 제품 스택은 Next.js App Router, TypeScript, Tailwind CSS, Supabase(Postgres·Auth·Storage·RLS), Vercel이다. 저장소와 실제 연동 상태를 확인하고, 계획된 기술을 이미 구축된 것처럼 설명하지 않는다.
- 사용자는 개발 과정에서 쉬운 설명을 선호한다. 현재 단계, 완료된 일, 막힌 이유와 다음 일을 짧고 구체적으로 알려준다.

### ign8t 작업 절차

기능 구현을 시작하기 전에 다음 순서를 지킨다.

1. ign8t에서 프로젝트 기준 컨텍스트를 확인한다 (`get_project`).
2. `document_type=master_spec`으로 제품 마스터 스펙을 읽는다 (`get_documents`).
3. 작업을 고르기 전에 다음 작업을 확인한다 (`get_next_task`).
4. 기존 작업이 목적에 맞지 않으면 사용자에게 먼저 알리고, 승인받은 뒤 `create_task`로 추가한다. 나중에 검토할 아이디어는 `add_feature_request`로 보낸다.
5. 선택한 작업의 상세 스펙이 없거나 구현에 필요한 인수 조건이 빠졌으면, 제품 코드를 쓰기 전에 ign8t에서 스펙을 보완하도록 사용자에게 요청한다.

작업 시작 시 변경 대상 스택에 맞는 모델을 먼저 추천한다. 구현이 끝나면 실제 확인 근거와 함께 ign8t 상태를 `review`로 옮기고, 사용자 최종 검토 없이 `done`으로 처리하지 않는다.

### 구현 원칙

- 참여자 화면은 기존 대시보드와 `(workspace)/layout.tsx`의 공통 앱셸을 베이스로 확장한다. 개별 페이지에 별도의 서비스 헤더·화면 폭·하단 메뉴를 중복 구현하지 않는다. 새 UI는 대시보드와 이동하며 일관성을 확인한다.

- Next.js 코드를 수정하기 전에 위 생성 블록의 안내에 따라 설치된 Next.js 버전의 문서를 확인한다. 학습 데이터나 다른 Next 버전의 관례를 그대로 적용하지 않는다.
- 화면 골격, 목업 데이터, 비활성 버튼은 연결된 기능의 완료를 뜻하지 않는다. DB·인증·권한·실제 사용자 흐름이 동작하는지 구분해서 설명한다.
- 인증과 역할 권한은 서버에서 검증한다. 강사는 워크숍 진행 메타데이터만 보고, 참여자의 이력서 원본과 비공개 AI 대화에는 접근할 수 없어야 한다.
- 이력서·연락처·AI 대화 등 개인 자료를 로그나 공개 응답에 포함하지 않는다. 공개 프로필에는 사용자가 검토해 공개한 데이터만 반환한다.
- 모든 사용자별 데이터 접근은 서버 권한 확인과 RLS 정책을 함께 적용한다. 공개 엔드포인트는 필요한 공개 필드만 조회한다.
- Supabase 키와 기타 비밀값을 코드·문서·커밋에 넣지 않는다. 로컬 환경 변수 파일은 저장소에 올리지 않는다.
- NFC 태그는 사전 인코딩 URL(`/t/{tag_id}`)을 서버에서 공개 프로필로 연결하는 방식이다. 브라우저 직접 NFC 쓰기는 범위에서 제외한다.
- 저장소에 실제 없는 API, 테이블, 배포 환경, 테스트 결과를 있다고 단정하지 않는다. 확인하지 못한 부분은 미확인으로 표시한다.

### Git 협업 규칙

- 브랜치 분리와 병합은 사용자가 직접 관리한다. Codex는 현재 작업공간에서 작업하고, 사용자가 요청하기 전에는 브랜치 생성·전환·병합을 수행하지 않는다.
- `dev`는 통합 개발 브랜치, `main`은 상용 배포 브랜치다. 사용자가 정한 흐름 없이 `main`에 직접 변경하거나 배포하지 않는다.
- `dev` 반영 시 PR에는 무엇이 바뀌었는지와 실제 확인한 항목·확인하지 못한 항목을 기록한다. Codex는 사용자가 PR 작성을 요청하면 이 내용을 제공한다.
- PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md`를 따른다. 기능 요구사항은 ign8t 작업에 연결하고, 배경·사용자 동작·핵심 변경·DB/RLS 변경·dev/prod 적용 및 웹 배포 상태·실제 검증·미확인 항목·리뷰 포인트를 남긴다. 관련 GitHub 이슈가 없으면 PR을 위해 이슈를 중복 생성하지 않는다.
- 병합 여부와 웹/DB 배포 성공 여부는 각각 확인해 기록한다. 코드가 빌드된 것을 실제 로그인·저장 성공으로 표시하지 않는다. 사용자 보고와 자동 검증을 구분하고, 수행하지 않은 검사는 체크하지 않는다.
- 커밋과 푸시는 사용자가 요청했거나 현재 세션의 지시가 명시적으로 허용한 경우에만 한다.
