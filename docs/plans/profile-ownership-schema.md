# Profile ownership DB draft

Source: ign8t task `74d9e320-758a-4f96-95ff-edf4fa75c104`, current My Orbit master spec. Migration: `20261103141135_profile_ownership_foundation.sql`. Applied to development project `my-orbit-dev` on 2026-11-03. The migration version matches Supabase migration history.

## Shape

- `profiles`: one row per `public.users` account (`unique user_id`), unique public slug, public headline/bio/theme, explicit `is_published=false` default. Keep this table free of resumes, interview transcripts, phone numbers, and unpublished private source material because published rows are readable by anyone.
- `project_items`: public profile cards linked by `profile_id`, with title, description, optional URL, order. Public only when parent profile is published. Owner can read and manage unpublished cards.
- `ai_interview_sessions`: private account-owned draft answers (`jsonb`), optional workshop reference, status. No admin/instructor access policy.
- `resume_documents`: private account-owned file metadata (path, file name, MIME type, byte size). The bytes require a separate private Storage bucket and matching object policies before uploads can be enabled.

Every table enables RLS. The two public-facing tables have published-row SELECT policies and owner CUD policies. The private tables require `auth.uid() = user_id` for all operations. Column grants keep client users from changing ownership and creation timestamps. API authorization and file upload restrictions are separate follow-up work.

## Design decisions and follow-up limits

- Public profile needs only headline, bio, theme, slug, and project cards at this stage. Contact details and publishable links need a later schema decision.
- Interview `answers` are a JSON object for the present three-step wizard; a future AI transcript may need a separate append-only table.
- `resume_documents` stores file metadata only. Define bucket name, path convention, file limits, permitted MIME types, and deletion behavior before enabling upload.
- This migration creates tables. The task spec described RLS for tables it assumed already existed, but the current dev DB has none of them.

## Verification and next

After applying, all four tables have RLS enabled. Transaction-rolled-back checks confirmed owner A can read and update a private profile, user A cannot see or update B's private profile, anonymous users see a published profile and its project but not an unpublished profile, and anonymous users lack SELECT grants on AI sessions and resume documents. User A saw only their own AI session and resume document, and cannot update the profile `user_id` column. Rollback left all four tables empty. Security advisors reported no new findings for these tables; earlier workshop RPC and policy notices remain.

The server ownership helper and profile/project edit APIs are now implemented in this branch. `profile_owner_status(uuid)` was added in migration `20261103141732_profile_owner_lookup.sql` to distinguish an existing foreign profile (403) from an absent ID (404) without returning its contents. It is callable only by authenticated users; Supabase's security advisor flags the intentional `SECURITY DEFINER` RPC, which must remain narrowly scoped. Browser requests on the development DB returned owner PATCH 200, foreign-owner PATCH 403, anonymous PATCH 401, project POST 201, project PATCH 200, and project DELETE 200. Test profiles and projects were removed (remaining 0). TypeScript, ESLint on changed API files, and the production Webpack build passed.

The owner-gated edit page at `/profiles/{profileId}/edit` now shows a form only to the owner; a foreign user sees a permission notice and a link to the published profile when available. Its save action uses the guarded PATCH endpoint. TypeScript and ESLint pass. A fresh production build could not finish because this network-restricted environment could not fetch Geist from `fonts.googleapis.com`; this is a build environment limit, not a successful build check for the new page.

Next: integrate the existing 3-step wizard with profile creation and link the dashboard to the edit screen. Define private Storage bucket/object policies before enabling file upload. The SQL has not been committed or deployed to production.
