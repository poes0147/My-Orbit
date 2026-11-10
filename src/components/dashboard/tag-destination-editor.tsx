"use client";

import { useRef, useState } from "react";
import PendingIndicator from "@/components/layouts/pending-indicator";
import { tagDestinationInputSchema, tagDestinationSchema, type TagDestination } from "@/lib/nfc/destination";
import Link from "next/link";
import { hasContact, type ContactCard } from "@/lib/nfc/contact-card";

const secondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50";

export default function TagDestinationEditor({ initialTags, profilePublished, cards = [] }: { initialTags: TagDestination[]; profilePublished: boolean; cards?: ContactCard[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tags, setTags] = useState(initialTags);
  const [editing, setEditing] = useState<string | null>(null);
  const [target, setTarget] = useState<TagDestination["target_type"]>("profile");
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [cardId, setCardId] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const selectedCard = cards.find(card => card.id === cardId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [urlError, setUrlError] = useState("");
  const [notice, setNotice] = useState("");

  function open(tag: TagDestination) {
    setEditing(tag.tag_id);
    setTarget(tag.target_type);
    setUrl(tag.custom_url ?? "");
    setAlias(tag.alias ?? ""); setCardId(tag.card_id ?? ""); setAcknowledged(false);
    setError("");
    setUrlError("");
    setNotice("");
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    dialog.current?.scrollTo(0, 0);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    const input = tagDestinationInputSchema.safeParse({ target_type: target, alias, acknowledged,
      ...(target === "custom_url" ? { custom_url: url } : target === "contact_card" ? { card_id: cardId } : {}),
    });
    if (!input.success) {
      setUrlError("연결 대상과 공개 동의 여부를 확인해 주세요.");
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
    <div className="flex flex-wrap gap-3"><Link href="/dashboard/cards" className={secondary}>내 명함 관리</Link><Link href="/t/bind" className={secondary}>새 오브제 등록</Link></div>
    <ul className="space-y-3">
      {tags.map(tag => <li key={tag.tag_id} className="rounded-2xl border border-stone-200 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-semibold">{tag.alias || "내 오브제"}</p><p className="font-mono text-xs text-stone-600">{tag.tag_id}</p>
          {!tag.is_active && <span className="text-xs font-semibold text-stone-600">사용 중단</span>}
        </div>
        <p className="mt-2 text-sm font-semibold">{tag.target_type === "profile" ? "내 공개 프로필" : tag.target_type === "none" ? "연결 중지" : tag.target_type === "contact_card" ? "명함 · " + (cards.find(card => card.id === tag.card_id)?.card_name ?? "명함") : "외부 링크"}</p>
        {tag.target_type === "custom_url" && <p className="mt-1 text-sm text-stone-600">{tag.custom_url}</p>}
        {tag.target_type === "profile" && !profilePublished && <p className="mt-1 text-sm text-amber-900">프로필이 비공개예요.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!tag.is_active} className={secondary} onClick={() => open(tag)}>연결 대상 변경</button>
          <a href={"/t/" + tag.tag_id} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-amber-900 underline" target="_blank" rel="noopener noreferrer">태그 주소 열기</a>
          <button type="button" className={secondary} onClick={async () => {
            const address = new URL("/t/" + tag.tag_id, location.origin).href;
            try { await navigator.clipboard.writeText(address); setNotice("고정 태그 주소를 복사했어요. NFC와 QR에 같은 주소를 사용하세요."); }
            catch { setNotice("주소를 직접 복사해 주세요: " + address); }
          }}>태그 링크 복사</button>
        </div>
      </li>)}
    </ul>
    <p role="status" className="text-sm text-stone-700">{notice}</p>
    <dialog ref={dialog} aria-labelledby="nfc-destination-title" onCancel={event => { if (busy) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 text-stone-950 backdrop:bg-stone-950/40">
      <form onSubmit={save} className="space-y-4">
        <h3 id="nfc-destination-title" tabIndex={-1} className="text-lg font-semibold">오브제 연결 대상 변경</h3>
        <p className="text-sm leading-6 text-stone-700">지금 태그와 QR 주소로 어떤 페이지를 열지 선택해 주세요.</p>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <fieldset disabled={busy} className="min-w-0 space-y-1">
          <legend className="sr-only">연결 대상</legend>
          <label className="block text-sm font-semibold">오브제 이름 (나만 볼 수 있어요)<input value={alias} maxLength={40} onChange={event => setAlias(event.target.value)} className="my-2 min-h-11 w-full min-w-0 rounded-xl border border-stone-400 px-3 text-base" /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="radio" name="nfc-target" disabled={!profilePublished} checked={target === "profile"} onChange={() => { setTarget("profile"); setUrlError(""); }} className="size-5 shrink-0 accent-stone-900" />
            내 My Orbit 프로필
          </label>
          {!profilePublished && <p className="text-sm text-amber-900">공개된 프로필이 있어야 프로필 연결을 선택할 수 있어요. 명함과 링크는 바로 사용할 수 있어요.</p>}
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="radio" name="nfc-target" checked={target === "contact_card"} onChange={() => { setTarget("contact_card"); setAcknowledged(false); }} className="size-5 shrink-0" />내 명함 바로 연결</label>
          {target === "contact_card" && <div className="space-y-3 rounded-xl bg-stone-50 p-3">
            <label className="block text-sm font-semibold">연결할 명함<select value={cardId} onChange={event => { setCardId(event.target.value); setAcknowledged(false); }} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-stone-400 bg-white px-2"><option value="">명함 선택</option>{cards.map(card => <option key={card.id} value={card.id} disabled={!hasContact(card)}>{card.card_name}{!hasContact(card) ? " (연락처 필요)" : ""}</option>)}</select></label>
            {selectedCard && <div className="space-y-1 text-sm" aria-label="공유할 명함 미리보기"><p className="font-semibold">공유될 정보</p>{[selectedCard.display_name, selectedCard.phone_number, selectedCard.email, selectedCard.organization_name, selectedCard.job_title, selectedCard.website_url].filter(Boolean).map((value, index) => <p key={index}>{value}</p>)}</div>}
            <Link href="/dashboard/cards" className="inline-flex min-h-11 items-center font-semibold text-amber-900 underline">명함 만들기·편집</Link>
            <p className="text-xs leading-5">프로필을 거치지 않고 연락처 파일로 연결해요. 연락처 최종 저장은 휴대폰에서 확인해야 해요.</p>
          </div>}
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
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="radio" name="nfc-target" checked={target === "none"} onChange={() => setTarget("none")} className="size-5 shrink-0" />연결 중지 (내 오브제는 유지)</label>
          {(target === "contact_card" || target === "custom_url") && <label className="flex min-h-11 items-start gap-2 pt-3 text-sm leading-6"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} className="mt-1 size-5 shrink-0" />태그·QR 주소를 가진 누구나 이 명함 또는 링크를 볼 수 있음을 확인했어요.</label>}
          {urlError && <p id="nfc-url-error" role="alert" className="text-sm text-red-800">{urlError}</p>}
        </fieldset>
        {busy && <PendingIndicator message="연결 대상을 바꾸고 있어요." />}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={secondary} disabled={busy} onClick={() => dialog.current?.close()}>취소</button>
          <button type="submit" className={primary} disabled={busy || (target === "profile" && !profilePublished) || ((target === "contact_card" || target === "custom_url") && !acknowledged) || (target === "contact_card" && (!selectedCard || !hasContact(selectedCard)))}>저장하기</button>
        </div>
      </form>
    </dialog>
  </div>;
}
