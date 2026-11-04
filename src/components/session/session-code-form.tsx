"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";

type SessionDetails = {
  sessionId: string;
  title: string;
  organizationName: string;
  expiresAt: string;
};

type ApiResult = {
  success: boolean;
  data?: SessionDetails & { redirectUrl?: string };
  error?: { message?: string };
};

export default function SessionCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verifiedSession, setVerifiedSession] = useState<SessionDetails | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const validCode = /^[A-Z0-9]{6}$/.test(code);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validCode || busy) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(verifiedSession ? "/api/workshops/join" : "/api/workshops/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCode: code }),
        cache: "no-store",
      });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.success) {
        setVerifiedSession(null);
        setMessage(result.error?.message ?? "코드를 확인하지 못했어요. 다시 시도해 주세요.");
        return;
      }

      if (!verifiedSession && result.data) {
        setVerifiedSession(result.data);
        return;
      }

      router.replace(result.data?.redirectUrl ?? "/builder");
      router.refresh();
    } catch {
      setMessage("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  function changeCode(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
    setVerifiedSession(null);
    setMessage(/[^A-Z0-9]/i.test(value) ? "영문과 숫자만 입력할 수 있어요." : "");
  }

  return <form onSubmit={submit} className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-stone-800 sm:mb-3">참여 코드</legend>
      <div className="w-full">
      <input
        id="session-code"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        required
        maxLength={6}
        pattern="[A-Za-z0-9]{6}"
        value={code}
        disabled={busy}
        onChange={changeCode}
        aria-label="6자리 참여 코드"
        aria-describedby="session-code-hint"
        aria-invalid={Boolean(message)}
        className="h-13 w-full rounded-xl border border-stone-300 px-4 text-center font-mono text-xl font-semibold uppercase tracking-[0.35em] outline-none transition placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal focus:border-amber-500 focus:ring-4 focus:ring-amber-100 sm:h-14"
        placeholder="예: A1B2C3"
      />
      </div>
    </fieldset>
    <p id="session-code-hint" className="text-xs text-stone-500">영문과 숫자 6자리를 한 번에 입력하거나 붙여넣어 주세요. 소문자는 자동으로 대문자로 바뀝니다.</p>
    {message && <p id="session-code-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>}

    {verifiedSession && <section aria-live="polite" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold text-amber-800">참여할 워크숍을 확인했어요</p>
      <h2 className="mt-2 font-semibold text-stone-950">{verifiedSession.title}</h2>
      <p className="mt-1 text-sm text-stone-600">{verifiedSession.organizationName}</p>
    </section>}

    <button
      type="submit"
      disabled={!validCode || busy}
      className="h-13 w-full rounded-xl bg-stone-900 text-sm font-semibold text-white transition hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:bg-stone-300 sm:h-14 sm:rounded-2xl sm:text-base"
    >
      {busy ? "확인 중…" : verifiedSession ? "이 워크숍에 참여하기" : "참여 코드 확인"}
    </button>
    {verifiedSession && <button type="button" disabled={busy} onClick={() => { setVerifiedSession(null); setMessage(""); }} className="w-full rounded-xl py-2 text-sm font-medium text-stone-600 underline underline-offset-4 disabled:opacity-50">다른 코드 입력</button>}
  </form>;
}
