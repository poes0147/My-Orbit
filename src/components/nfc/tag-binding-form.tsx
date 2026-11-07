"use client";

import { useState } from "react";
import Link from "next/link";
import PendingIndicator from "@/components/layouts/pending-indicator";
import { registrationCodeSchema } from "@/lib/nfc/tag";

const button = "inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50";

export default function TagBindingForm({ tagId }: { tagId: string }) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function bind(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || blocked) return;
    const parsed = registrationCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError("오브제와 함께 받은 등록 코드를 확인해 주세요.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/tags/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tagId, registration_code: parsed.data }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message ?? "연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
        setBlocked(response.status === 409);
        return;
      }
      setCode("");
      setConnected(true);
    } catch {
      setError("인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  if (connected) return <div className="mt-5 space-y-4">
    <p role="status" className="font-semibold">오브제를 연결했어요. 이제 태그나 QR을 열면 공개 프로필로 이동해요.</p>
    <Link href="/dashboard" className={button}>대시보드로 이동</Link>
  </div>;

  return <form className="mt-5 space-y-4" onSubmit={bind}>
    <label className="block text-sm font-semibold">일회용 등록 코드
      <input type="text" value={code} required maxLength={48} autoComplete="off" spellCheck={false} autoCapitalize="off"
        onChange={event => setCode(event.target.value)} disabled={pending || blocked}
        className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-stone-500 px-3 font-mono text-base focus:outline-2 focus:outline-offset-2 focus:outline-amber-800" />
    </label>
    <button type="submit" disabled={pending || blocked || !code.trim()} className={button}>내 공개 프로필에 연결하기</button>
    {pending && <PendingIndicator message="오브제와 프로필을 연결하고 있어요." />}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </form>;
}
