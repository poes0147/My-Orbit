"use client";

import { useRef, useState } from "react";
import PendingIndicator from "@/components/layouts/pending-indicator";
import { tagDestinationInputSchema, tagDestinationSchema, type TagDestination } from "@/lib/nfc/destination";

const secondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50";

export default function TagDestinationEditor({ initialTags, profilePublished }: { initialTags: TagDestination[]; profilePublished: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tags, setTags] = useState(initialTags);
  const [editing, setEditing] = useState<string | null>(null);
  const [target, setTarget] = useState<TagDestination["target_type"]>("profile");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [urlError, setUrlError] = useState("");
  const [notice, setNotice] = useState("");

  function open(tag: TagDestination) {
    setEditing(tag.tag_id);
    setTarget(tag.target_type);
    setUrl(tag.custom_url ?? "");
    setError("");
    setUrlError("");
    setNotice("");
    dialog.current?.showModal();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    const input = tagDestinationInputSchema.safeParse({ target_type: target, custom_url: target === "custom_url" ? url : null });
    if (!input.success) {
      setUrlError("보안을 위해 공개 HTTPS 링크만 등록할 수 있어요.");
      return;
    }
    setBusy(true);
    setError("");
    setUrlError("");
    try {
      const response = await fetch("/api/tags/" + editing + "/destination", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data),
      });
      const result = await response.json();
      const saved = tagDestinationSchema.safeParse(result.data);
      if (response.ok && saved.success) {
        setTags(previous => previous.map(tag => tag.tag_id === editing ? saved.data : tag));
        setNotice("연결 대상을 바꿨어요. 같은 태그와 QR에 바로 반영돼요.");
        dialog.current?.close();
      } else if (response.status === 403 || response.status === 404) {
        setNotice(result.message ?? "이 태그를 변경할 수 없어요.");
        dialog.current?.close();
      } else if (response.status === 400) {
        setUrlError(result.message ?? "공개 HTTPS 웹 주소를 확인해 주세요.");
      } else {
        setError(result.message ?? "연결 대상을 바꾸지 못했어요. 다시 시도해 주세요.");
      }
    } catch {
      setError("인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 space-y-3 [overflow-wrap:anywhere] [word-break:keep-all]">
    <ul className="space-y-3">
      {tags.map(tag => <li key={tag.tag_id} className="rounded-2xl border border-stone-200 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-mono text-xs text-stone-600">{tag.tag_id}</p>
          {!tag.is_active && <span className="text-xs font-semibold text-stone-600">사용 중단</span>}
        </div>
        <p className="mt-2 text-sm font-semibold">{tag.target_type === "profile" ? "내 공개 프로필" : "외부 링크"}</p>
        {tag.target_type === "custom_url" && <p className="mt-1 text-sm text-stone-600">{tag.custom_url}</p>}
        {tag.target_type === "profile" && !profilePublished && <p className="mt-1 text-sm text-amber-900">프로필이 비공개예요.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!tag.is_active} className={secondary} onClick={() => open(tag)}>연결 대상 변경</button>
          <a href={"/t/" + tag.tag_id} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-amber-900 underline" target="_blank" rel="noopener noreferrer">태그 주소 열기</a>
        </div>
      </li>)}
    </ul>
    <p role="status" className="text-sm text-stone-700">{notice}</p>
    <dialog ref={dialog} aria-labelledby="nfc-destination-title" onCancel={event => { if (busy) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 text-stone-950 backdrop:bg-stone-950/40">
      <form onSubmit={save} className="space-y-4">
        <h3 id="nfc-destination-title" className="text-lg font-semibold">오브제 연결 대상 변경</h3>
        <p className="text-sm leading-6 text-stone-700">지금 태그와 QR 주소로 어떤 페이지를 열지 선택해 주세요.</p>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <fieldset disabled={busy} className="min-w-0 space-y-1">
          <legend className="sr-only">연결 대상</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="radio" name="nfc-target" checked={target === "profile"} onChange={() => { setTarget("profile"); setUrlError(""); }} className="size-5 shrink-0 accent-stone-900" />
            내 My Orbit 프로필
          </label>
          {target === "profile" && !profilePublished && <p className="text-sm text-amber-900">프로필을 공개하면 방문자가 볼 수 있어요.</p>}
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="radio" name="nfc-target" checked={target === "custom_url"} onChange={() => setTarget("custom_url")} className="size-5 shrink-0 accent-stone-900" />
            외부 HTTPS 링크
          </label>
          {target === "custom_url" && <label className="block text-sm font-semibold">외부 링크 주소
            <input type="text" inputMode="url" value={url} maxLength={500} autoCapitalize="off" spellCheck={false}
              onChange={event => { setUrl(event.target.value); setUrlError(""); }} aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? "nfc-url-error" : undefined} placeholder="https://instagram.com/..."
              className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-stone-500 px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800" />
          </label>}
          {target === "custom_url" && <p className="pt-1 text-xs leading-5 text-stone-700">프로필을 비공개로 바꿔도 태그에서는 이 외부 링크가 열려요.</p>}
          {urlError && <p id="nfc-url-error" role="alert" className="text-sm text-red-800">{urlError}</p>}
        </fieldset>
        {busy && <PendingIndicator message="연결 대상을 바꾸고 있어요." />}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={secondary} autoFocus disabled={busy} onClick={() => dialog.current?.close()}>취소</button>
          <button type="submit" className={primary} disabled={busy}>저장하기</button>
        </div>
      </form>
    </dialog>
  </div>;
}
