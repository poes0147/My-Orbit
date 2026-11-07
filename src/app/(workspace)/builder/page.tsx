import ProfileWizard from "@/components/builder/profile-wizard";
import SavedDraftEditor from "@/components/builder/saved-draft-editor";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { readSavedDraft } from "@/lib/builder/read-saved-draft";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function BuilderPage() {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-stone-600">프로필 초안을 불러오고 있어요.</p>}>
      <BuilderContent />
    </Suspense>
  );
}

async function BuilderContent() {
  const context = await getWorkspaceContext();
  if (context.workshopUnavailable) throw new Error("워크숍 정보를 확인하지 못했어요.");
  if (context.workshop) return <ProfileWizard />;

  const supabase = await createSupabaseServerClient();
  const result = await readSavedDraft(supabase, context.id);
  if (result.status !== 200) throw new Error(result.message);
  if (!result.draft) redirect("/session");

  return (
    <>
      <h1 className="text-2xl font-semibold">저장한 프로필 초안</h1>
      <p className="mt-2 text-sm text-stone-600">저장한 문구를 편집하고 미리볼 수 있어요.</p>
      <SavedDraftEditor workshopSessionId={result.workshopSessionId} revision={0} locked={false} />
    </>
  );
}
