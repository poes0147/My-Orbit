# Strength analysis v0.1 implementation plan

**Goal:** Evidence-based recommendations from 24 strengths, reviewed by the owner before applying to a private draft.
**Architecture:** Existing OpenAI Responses configuration extracts evidence; pure TypeScript validates/ranks it. Owner-only, expiring database cache; shared review panel in wizard and saved draft editor. Existing explicit profile commit remains the only profile mutation.
**Spec:** ign8t task 7e647ef8-a12a-4bfe-a3ae-323f518e7a08, spec afebe222-dcdc-47a2-bf50-168472b45826 plus review notes.

## Constraints and rulings
- Work in current branch; no commit, push, deployment or hosted database mutations requested.
- Preserve original consent/retention policy; cached evidence expires in 24 hours and is cleaned by cron.
- Existing publication trigger already requires one tag. Keep that requirement; allow zero tags in private drafts and private profile saves.
- Parsed resume data is reviewed and applied into the existing experience form. Analyze that user-reviewed text, not an unselected resume silently.
- Do not use arbitrary time thresholds or extra unpaid work as requirements for strengths.
- No strength/color connection. Keep installed packages and OpenAI configuration.
- Custom tags are explicitly user-written, and evidence stays out of published profiles.

## Review focus
Repeated/cross-source experiences; negative/aspirational/other-person actions; stale responses while typing; zero-tag saves and publication; cross-owner/expired cache access.

## Tasks
- [x] Add failing ranking tests, then taxonomy/schema/ranker: validate quotes in their source field; reject ineligible context; merge duplicate experiences; cap distinct actions per experience at two; suppress candidates using only the same evidence; deterministic tie ordering.
- [x] Add local SQL tests, migration for owner-only cache and account quota; relax existing commit function to 0–3 tags while preserving conflict/idempotency checks.
- [x] Add authenticated analyze API using bounded input, existing AI config, structured output and versioned per-owner cache; never generate fabricated fallback strengths.
- [x] Add review panel to experience form and saved draft editor. Apply verified selection explicitly; persist private draft through existing flow; preserve user selection during full-profile generation. Block stale application.
- [x] Run ranking/API/database regression tests, lint/type/build, and desktop/320px browser verification. Record unavailable live-service checks. Move task to review, not done.

## Execution record
- Private drafts/profile saves allow 0–3 tags; existing publication requirement of at least one tag retained.
- Saved editor shares confirmed tags/source with the wizard so full regeneration preserves the latest choice.
- Generated examples had overly restrictive dictionary criteria; implementation uses agreed definitions, not duration/extra-work tests.
- New profiles no longer manufacture three fallback tags; analysis/explicit user selection supplies them.
- Review and validation evidence: docs/reviews/2026-11-16-strength-analysis.md. Hosted migration/deployment and real authenticated end-to-end checks remain pending.
