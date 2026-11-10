"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PendingIndicator from "@/components/layouts/pending-indicator";

const action = "inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50";

export default function ProfilePublication({ published, slug, disabled, hasUnsavedChanges = false, onChange }: {
  published: boolean;
  slug: string;
  disabled: boolean;
  hasUnsavedChanges?: boolean;
  onChange: (published: boolean, slug: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState<{ slug: string; url: string } | null>(null);
  const href = link?.slug === slug ? link.url : "/p/" + slug;

  async function change() {
    if (busy || disabled || (!published && hasUnsavedChanges)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profiles/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !published }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "공개 상태를 변경하지 못했어요. 다시 시도해 주세요.");
        return;
      }
      const data = result.data;
      setLink(data.public_url ? { slug: data.user_slug, url: data.public_url } : null);
      onChange(data.is_published, data.user_slug);
      setNotice(data.is_published ? "프로필을 발행했어요. 이제 링크를 공유할 수 있어요." : "프로필을 비공개로 전환했어요.");
      dialog.current?.close();
      router.refresh();
    } catch {
      setError("연결 상태를 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
      setNotice("공개 링크를 복사했어요.");
    } catch {
      setNotice("복사하지 못했어요. 공개 프로필을 열어 주소창의 링크를 복사해 주세요.");
    }
  }

  return <section aria-labelledby="publication-title" className="mb-6 space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-5 [overflow-wrap:anywhere] [word-break:keep-all]">
    <div className="flex flex-wrap items-center gap-3">
      <h2 id="publication-title" className="font-semibold">프로필 공개</h2>
      <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">{published ? "공개 중" : "비공개"}</span>
    </div>
    <p className="text-sm leading-6 text-stone-700">{published ? "현재 저장된 프로필은 누구나 볼 수 있어요. 변경사항을 저장하면 공개 페이지에도 반영돼요." : "저장만 하면 본인만 볼 수 있어요. 공개 발행을 선택해야 다른 사람에게 보여요."}</p>
    {hasUnsavedChanges && <p role="status" className="text-sm font-medium text-amber-900">아직 저장하지 않은 수정 내용이 있어요. 아래 ‘변경사항 저장’을 눌러 주세요.</p>}
    {published && <p className="text-sm text-stone-700">{href}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={published ? action : primary} disabled={disabled || busy || (!published && hasUnsavedChanges)} onClick={() => {
        setAgreed(false);
        setError("");
        setNotice("");
        dialog.current?.showModal();
      }}>{published ? "공개 해제" : "공개 발행하기"}</button>
      {published && <>
        <a href={href} target="_blank" rel="noopener noreferrer" className={action}>공개 프로필 보기</a>
        <button type="button" className={action} onClick={() => void copyLink()}>링크 복사</button>
      </>}
    </div>
    <p role="status" className="text-sm text-stone-700">{notice}</p>
    <dialog ref={dialog} aria-labelledby="publication-dialog-title" onCancel={event => { if (busy) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 text-stone-950 backdrop:bg-stone-950/40">
      <h3 id="publication-dialog-title" className="text-lg font-semibold">{published ? "프로필 공개를 해제할까요?" : "내 프로필을 외부에 공개할까요?"}</h3>
      {published ? <p className="mt-3 text-sm leading-6">기존 링크로는 다른 사람이 프로필과 연락처 파일을 볼 수 없게 돼요. 작성한 내용은 보존되며 계속 편집하거나 다시 발행할 수 있어요.</p> : <>
        <p className="mt-3 text-sm leading-6">발행하면 링크가 있는 누구나 저장된 프로필을 볼 수 있어요.</p>
        <ul className="mt-3 space-y-2 text-sm leading-6">
          <li><strong>공개</strong> · 공개 이름, 사진, 한 줄 소개, 핵심 역량, 자기소개, 프로젝트와 링크, 별도로 등록된 공개 연락처</li>
          <li><strong>비공개</strong> · 로그인 이메일, 이력서 원본, AI 인터뷰 답변</li>
        </ul>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="size-5 shrink-0 accent-stone-900" checked={agreed} disabled={busy} onChange={event => setAgreed(event.target.checked)} />
          공개 범위를 확인했고 발행에 동의해요.
        </label>
      </>}
      {busy && <PendingIndicator message={published ? "공개를 해제하고 있어요." : "프로필을 발행하고 있어요."} />}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" autoFocus className={action} disabled={busy} onClick={() => dialog.current?.close()}>취소</button>
        <button type="button" className={primary} disabled={disabled || busy || (!published && (!agreed || hasUnsavedChanges))} onClick={() => void change()}>
          {published ? "공개 해제 확정" : "발행 확정"}
        </button>
      </div>
    </dialog>
  </section>;
}
