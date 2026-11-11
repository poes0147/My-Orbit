# Admin NFC tag management implementation plan

> Execute inline with superpowers:executing-plans. User authorized spec generation and implementation together.

**Goal:** Issue one NFC tag in the admin area and copy its scan URL, registration URL and one-time code; list legacy/new tags safely.
**Architecture:** Existing admin guard and request client; authenticated admin-only RPC wrappers around existing private issuance helper. Private idempotency ledger stores tag IDs, never codes. No hosted data mutations.
**Tech Stack:** Installed Next 16, React, Supabase PostgreSQL, PGlite fixture tests.
**Spec:** ign8t task 127c0cc2-7c93-40b8-84cd-e51b1a781ef1, spec 6f9d2f52-5512-4f84-b507-813275918376.

## Global constraints and repository reconciliation
- Keep existing 32-hex tag/code format, claim_code_hash bytea, mapped_at and owner_id. Generated spec's shorter codes, duplicate columns and caller-supplied admin ID conflict with existing binding/security contracts.
- No bulk issuance, deletion, reassignment or destination edits here. No plaintext persistence or logs.
- Required UUID idempotency key. A repeat returns the same tag but no code. On uncertain response, retry same key; warn if code was lost. No automatic new issuance.
- RPC checks auth.uid against users.role. List returns only tag ID, dates, active/bound flags; no user details or hash.
- No branch changes/commits/push without current authorization; preserve current workspace.

## Review focus
- Repeated/parallel request produces one tag and only initial response contains code.
- Non-admin calling RPC directly cannot issue/list.
- List includes claimed legacy rows without changing ownership or destinations.
- Lost code cannot be recovered; explicit warning and acknowledgment before dismissing results.
- 320px long URLs wrap, buttons remain reachable, clipboard failure gives manual-copy fallback.

## Tasks
- [x] 1. Add failing local database tests for admin issuance/list, denied roles, idempotency and profileless binding. Implement new migration RPCs and private ledger, run full database tests.
- [x] 2. Add request validation/API tests, implement GET /api/admin/nfc-tags and POST /api/admin/nfc-tags/issue, safe typed projections and no-store responses.
- [x] 3. Add /admin/nfc-tags to existing shell/home. Loading/error/empty states, paginated desktop table/mobile cards, issuance result and separate copy actions. Keep pending key only in memory until resolved.
- [x] 4. Verify actual UI/API with disposable local fixture (320/1280), issuance→binding→destination. Run lint/type/build and fresh review. Document unapplied migration and remaining hosted checks.

## Verification ledger
Database test RED missing RPC → GREEN. API tests RED missing module → GREEN. 8 targeted/access/regression tests pass. Lint/type/build pass.
Independent reviewer found internal-navigation loss and focus restoration; fixed and browser verified (2 confirmations, Back/menu cancellation preserved result, focus restored).
Ruling: generated spec's duplicate fields and shortened code format replaced by existing schema contract; cost is longer copyable IDs, avoids breaking existing claims.
Ruling: optional custom ID omitted in favor of approved automatic single issuance; no custom ID UI promised by task scope.
Full evidence/limitations: docs/reviews/2026-11-11-admin-nfc-tags.md. No commit/push, hosted schema change or deployment performed.
