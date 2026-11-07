"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import PendingIndicator from "@/components/layouts/pending-indicator";
import type { EditableText } from "@/lib/builder/editable-draft";

export default function CommitProfileAction({ draftId, content, profile }: {
  draftId: string;
  content: EditableText;
  profile: { id: string; is_published: boolean } | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestKey = useRef<string | null>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const button = "inline-flex min-h-11 items-center rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-60";

  async function save() {
    if (saving.current) return;
    saving.current = true;
    dialog.current?.close();
    setBusy(true);
    setError("");
    try {
      requestKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/profiles/commit-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftSessionId: draftId, idempotencyKey: requestKey.current, expectedContent: content, existingProfileId: profile?.id ?? null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message ?? "프로필을 저장하지 못했어요.");
      setProfileId(result.data.profileId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "연결을 확인하고 다시 시도해 주세요.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      {busy && <PendingIndicator message="내 프로필을 비공개로 저장하고 있어요." overlay />}
      {profileId ? <>
        <p role="status" className="text-sm font-semibold">내 프로필을 비공개로 저장했어요.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/profiles/${profileId}/edit`} prefetch={false} className={button}>저장된 프로필 편집</Link>
          <Link href="/dashboard" prefetch={false} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold underline">대시보드로 이동</Link>
        </div>
      </> : profile?.is_published ? <p className="text-sm text-stone-700">공개 중인 프로필에는 초안을 반영할 수 없어요.</p> :
        <button type="button" className={button} disabled={busy} onClick={() => profile ? dialog.current?.showModal() : void save()}>
          {busy ? "저장 중…" : "내 프로필로 저장"}
        </button>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <dialog ref={dialog} aria-labelledby="commit-profile-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-5 backdrop:bg-black/40">
        <h2 id="commit-profile-title" className="font-semibold">기존 프로필에 초안을 반영할까요?</h2>
        <p className="mt-2 text-sm leading-6">한 줄 소개, 역량 태그, 초안에서 가져온 대표 프로젝트가 바뀝니다. 직접 작성한 자기소개와 추가 프로젝트는 유지돼요.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" autoFocus className="min-h-11 px-3 text-sm font-medium" onClick={() => dialog.current?.close()}>취소</button>
          <button type="button" className={button} onClick={() => void save()}>내 프로필에 반영</button>
        </div>
      </dialog>
    </div>
  );
}
