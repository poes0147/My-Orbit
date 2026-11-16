# AI follow-up interview implementation plan

**Goal:** One optional adaptive question at a time, at most three, with explicit reviewed application to the existing experience form.
**Spec:** ign8t task 637e7e08-8c0d-47ca-8bca-93e454ee430f, spec e7447d1c-4da2-4741-afbf-1186ef773253 (ready, user authorized generation and implementation).
**Architecture:** Existing cookie-authenticated route helpers and configured OpenAI Responses model. Private expiring session stores base experience and answered/pending questions; optimistic revision protects edits. The final proposal copies the user's original answers into matching fields, never invents a summary. Existing profile save/publication path remains unchanged.
**Stack:** Installed Next/React/TypeScript/Zod/Supabase, node:test and disposable PGlite.

## Decisions
- Generated spec names nonexistent form and resume columns. Use actual Draft experience/situation/role/action/result; only user-reviewed resume content already applied to these fields.
- Follow UX limit 500 chars / five non-whitespace chars and 5 AI requests/min/account, resolving conflicting API examples.
- Preserve installed model configuration, not generated GPT-4o recommendation. No new dependency.
- Base input and Q&A private 24h; owner-only RLS and cleanup. No new original PDF storage.
- Editing a previous answer discards later questions/answers with an explicit warning; future questions must use updated context.
- A proposal may exceed 500 chars: show full text and require editing, never truncate facts silently.
- Empty experience entry available before required step-one validation, as well as step two.
- Work in current user-managed branch. No branch switching, remote migration, commit or deployment during implementation.

## Tasks
- [x] Add behavioral tests for question cap, skip/edit, stale revision/input, quote-preserving proposal and limits; observe failure.
- [x] Implement typed session contract, question generator and next/answer/apply owner APIs.
- [x] Add CLI-created migration, RLS, 24h cleanup and quota; test local owner/foreign/anonymous isolation and generate types.
- [x] Integrate responsive interview panel into existing wizard, restore active session, review/edit/apply without changing profile.
- [x] Run tests/lint/types/build; inspect actual component at 320/1280; review full changes once and fix findings.
- [x] Record evidence and remaining deployed E2E check; ign8t review.

