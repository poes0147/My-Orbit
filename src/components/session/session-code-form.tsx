"use client";

import { useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";
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
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [characters, setCharacters] = useState<string[]>(["", "", "", "", "", ""]);
  const [verifiedSession, setVerifiedSession] = useState<SessionDetails | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const code = characters.join("");
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

  function changeCode(index: number, value: string) {
    const nextCharacter = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const nextCharacters = [...characters];
    nextCharacters[index] = nextCharacter;
    setCharacters(nextCharacters);
    setVerifiedSession(null);
    setMessage(value && !/^[A-Z0-9]$/i.test(value) ? "영문과 숫자만 입력할 수 있어요." : "");
    if (nextCharacter && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function pasteCode(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").toUpperCase();
    const nextCharacters = pasted.replace(/[^A-Z0-9]/g, "").slice(0, 6).split("");
    while (nextCharacters.length < 6) nextCharacters.push("");
    setCharacters(nextCharacters);
    setVerifiedSession(null);
    setMessage(/[^A-Z0-9\s-]/.test(pasted) ? "영문과 숫자만 입력할 수 있어요." : "");
    inputRefs.current[Math.min(nextCharacters.filter(Boolean).length, 5)]?.focus();
  }

  function moveFocus(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (characters[index]) {
        const nextCharacters = [...characters];
        nextCharacters[index] = "";
        setCharacters(nextCharacters);
        setVerifiedSession(null);
        setMessage("");
      }
      if (index > 0) inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  return <form onSubmit={submit} className="mt-8 space-y-4">
    <fieldset>
      <legend className="mb-3 block text-sm font-medium text-stone-800">참여 코드</legend>
      <div className="flex gap-2">
      {Array.from({ length: 6 }, (_, index) => <input
        key={index}
        ref={element => { inputRefs.current[index] = element; }}
        id={index === 0 ? "session-code" : undefined}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        required
        maxLength={1}
        pattern="[A-Za-z0-9]"
        value={characters[index]}
        disabled={busy}
        onChange={event => changeCode(index, event.target.value)}
        onPaste={pasteCode}
        onKeyDown={event => moveFocus(event, index)}
        aria-label={`참여 코드 ${index + 1}번째 문자`}
        aria-describedby="session-code-hint"
        aria-invalid={Boolean(message)}
        className="h-14 min-w-0 flex-1 rounded-xl border border-stone-300 text-center text-lg font-semibold uppercase outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
      />)}
      </div>
    </fieldset>
    <p id="session-code-hint" className="text-xs text-stone-500">영문과 숫자 6자리를 입력해 주세요. 소문자는 자동으로 대문자로 바뀌며, 코드를 붙여넣을 수도 있어요.</p>
    {message && <p id="session-code-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>}

    {verifiedSession && <section aria-live="polite" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold text-amber-800">참여할 워크숍을 확인했어요</p>
      <h2 className="mt-2 font-semibold text-stone-950">{verifiedSession.title}</h2>
      <p className="mt-1 text-sm text-stone-600">{verifiedSession.organizationName}</p>
    </section>}

    <button
      type="submit"
      disabled={!validCode || busy}
      className="h-14 w-full rounded-2xl bg-stone-900 font-semibold text-white transition hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:bg-stone-300"
    >
      {busy ? "확인 중…" : verifiedSession ? "이 워크숍에 참여하기" : "참여 코드 확인"}
    </button>
    {verifiedSession && <button type="button" disabled={busy} onClick={() => { setVerifiedSession(null); setMessage(""); }} className="w-full rounded-xl py-2 text-sm font-medium text-stone-600 underline underline-offset-4 disabled:opacity-50">다른 코드 입력</button>}
  </form>;
}
