"use client";

import { useRef, useState } from "react";
import { contactCardSchema, type ContactCard } from "@/lib/nfc/contact-card";
import PendingIndicator from "@/components/layouts/pending-indicator";

const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50";
const fields = [
  ["card_name", "관리용 명함 이름 (나만 볼 수 있어요)", 40, "text"],
  ["display_name", "공개 이름", 80, "text"], ["phone_number", "전화번호", 40, "tel"],
  ["email", "이메일", 254, "email"], ["organization_name", "회사·단체", 100, "text"],
  ["job_title", "직함", 100, "text"], ["website_url", "웹사이트 (HTTPS)", 500, "url"],
] as const;

export default function ContactCardManager({ initialCards, linkedCounts }: { initialCards: ContactCard[]; linkedCounts: Record<string, number> }) {
  const [cards, setCards] = useState(initialCards);
  const [editing, setEditing] = useState<ContactCard | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  function open(card: ContactCard | null) {
    setEditing(card); setFormVersion(value => value + 1); setError(""); setNotice("");
    dialog.current?.showModal();
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contact-cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing?.id ?? null, data }) });
      const result = await response.json();
      const parsed = contactCardSchema.safeParse(result.data);
      if (!response.ok || !parsed.success) { setError(result.message ?? "명함을 저장하지 못했어요."); return; }
      setCards(previous => [parsed.data, ...previous.filter(card => card.id !== parsed.data.id)]);
      setNotice("명함을 저장했어요. 오브제에 연결한 명함은 변경 내용이 바로 반영돼요.");
      dialog.current?.close();
    } catch { setError("인터넷 연결을 확인해 주세요."); }
    finally { setBusy(false); }
  }
  async function remove(card: ContactCard) {
    if (busy || !window.confirm(`‘${card.card_name}’ 명함을 삭제할까요? 이 화면을 열 때 연결된 오브제는 ${linkedCounts[card.id] ?? 0}개예요. 삭제 시 현재 연결된 모든 오브제는 연결 중지로 바뀌어요.`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/contact-cards", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: card.id }) });
      const result = await response.json();
      if (!response.ok) { setNotice(result.message ?? "삭제하지 못했어요."); return; }
      setCards(previous => previous.filter(item => item.id !== card.id));
      setNotice("명함을 삭제하고 연결된 오브제를 중지했어요.");
    } catch { setNotice("인터넷 연결을 확인해 주세요."); }
    finally { setBusy(false); }
  }
  return <div className="mt-6 space-y-4 [overflow-wrap:anywhere]">
    <button className={button} disabled={busy} onClick={() => open(null)}>새 명함 만들기</button>
    <p role="status" className="text-sm text-stone-700">{notice}</p>
    {!cards.length && <p className="rounded-xl bg-stone-50 p-4">아직 명함이 없어요. 공개할 정보만 직접 입력해 주세요.</p>}
    <ul className="grid gap-4 sm:grid-cols-2">{cards.map(card => <li key={card.id} className="min-w-0 rounded-2xl border border-stone-200 p-5">
      <h2 className="font-semibold">{card.card_name}</h2>
      <p className="mt-2 text-sm">{card.display_name}</p>
      <p className="text-sm text-stone-600">{card.phone_number || card.email || "연락처 미입력 · 오브제에 연결하려면 전화번호나 이메일이 필요해요."}</p>
      <p className="mt-2 text-xs text-stone-600">연결된 오브제 {linkedCounts[card.id] ?? 0}개</p>
      <div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => open(card)}>명함 편집</button><button className={button} disabled={busy} onClick={() => remove(card)}>삭제</button></div>
    </li>)}</ul>
    <dialog ref={dialog} aria-labelledby="card-editor-title" onCancel={event => { if (busy) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-stone-950 backdrop:bg-stone-950/40">
      <form ref={form} key={formVersion} onSubmit={save} className="space-y-4" autoComplete="off">
        <h2 id="card-editor-title" className="text-lg font-semibold">{editing ? "명함 편집" : "새 명함 만들기"}</h2>
        <p className="text-sm leading-6 text-stone-600">저장만 하면 나만 볼 수 있어요. 오브제에 연결하면 프로필 공개 여부와 관계없이 연락처가 공유돼요. 휴대폰에서 최종 저장은 방문자가 확인해요.</p>
        {editing && <p className="text-sm text-amber-900">연결된 오브제 {linkedCounts[editing.id] ?? 0}개. 이 명함을 사용하는 모든 오브제에 변경 내용이 반영돼요.</p>}
        <p className="text-xs leading-5 text-stone-600">이미 상대가 다운로드하거나 저장한 연락처는 나중에 수정·삭제해도 회수되지 않아요.</p>
        <fieldset disabled={busy} className="min-w-0 space-y-3">
          <legend className="sr-only">명함 정보</legend>
          {fields.map(([name, label, max, type]) => <label key={name} className="block text-sm font-semibold">{label}
            <input name={name} type={type} defaultValue={editing?.[name] ?? ""} maxLength={max} required={name === "card_name" || name === "display_name"} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-stone-400 px-3 text-base" />
          </label>)}
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        {busy && <PendingIndicator message="명함을 저장하고 있어요." />}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={() => { dialog.current?.close(); form.current?.reset(); }}>취소</button><button className={button} disabled={busy}>명함 저장</button></div>
      </form>
    </dialog>
  </div>;
}
