"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type Session = { id: string; session_code: string; title: string; organization_name: string; status: string; expires_at: string; max_capacity: number };
const button = "min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-50";
const input = "mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-2 focus:outline-amber-700";

export default function SessionManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [presenting, setPresenting] = useState<Session | null>(null);
  const [now, setNow] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const presentation = useRef<HTMLDialogElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);

  async function load(signal?: AbortSignal) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/workshops", { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "목록을 불러오지 못했어요.");
      setNow(Date.now());
      setSessions(result.sessions);
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "연결을 확인하고 다시 시도해 주세요.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/workshops", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.get("title"), organization: data.get("organization"), maxCapacity: Number(data.get("capacity")), durationHours: Number(data.get("duration")) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "세션을 만들지 못했어요.");
      setSessions(current => [result.session, ...current]);
      form.reset(); dialog.current?.close();
      setNotice("워크숍을 만들었어요. 참여 코드를 공유해 주세요.");
    } catch (error) { setError(error instanceof Error ? error.message : "연결을 확인하고 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  async function changeStatus(session: Session) {
    const active = session.status === "ACTIVE";
    if (busy || !active || !window.confirm("이 워크숍 참여를 종료할까요? 종료하면 새로운 참여자가 입장할 수 없어요.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/workshops/${session.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "상태를 변경하지 못했어요.");
      setSessions(current => current.map(item => item.id === session.id ? result.session : item));
      setNotice("참여를 종료했어요.");
    } catch (error) { setError(error instanceof Error ? error.message : "연결을 확인하고 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("복사했어요."); }
    catch { setNotice("복사하지 못했어요. 화면의 코드를 직접 선택해 복사해 주세요."); }
  }

  return <>
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div><h1 className="text-3xl font-semibold tracking-tight">워크숍 코드 관리</h1><p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">워크숍 참여 코드를 발급하고 전체 워크숍의 상태를 관리하세요.</p></div>
      <button ref={createButton} className={`${button} border-stone-900 bg-stone-900 text-white hover:bg-stone-700`} onClick={() => { setError(""); dialog.current?.showModal(); }}>새 워크숍 만들기</button>
    </div>
    <p role="status" className="mt-5 text-sm text-amber-900">{notice}</p>
    {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={() => load()}>다시 불러오기</button></div>}
    {!loading && sessions.length > 0 && <div className="mt-6 hidden overflow-x-auto rounded-xl border border-stone-200 bg-white md:block"><table className="w-full text-left text-sm"><caption className="sr-only">전체 워크숍 코드 목록</caption><thead className="bg-stone-50"><tr>{["워크숍 / 기관", "참여 코드", "상태 / 정원", "만료", "관리"].map(label => <th key={label} scope="col" className="px-3 py-4 font-semibold">{label}</th>)}</tr></thead><tbody>{sessions.map(session => {
      const active = session.status === "ACTIVE" && Date.parse(session.expires_at) > now;
      return <tr key={session.id} className="border-t border-stone-200"><td className="max-w-52 break-words px-3 py-4 font-medium">{session.title}<span className="mt-1 block text-xs font-normal text-stone-500">{session.organization_name}</span></td><td className="px-3 py-4 font-mono font-bold tracking-widest">{session.session_code}</td><td className="px-3 py-4">{Date.parse(session.expires_at) <= now ? "만료" : active ? "참여 가능" : "참여 종료"}<span className="mt-1 block text-xs">{session.max_capacity}명</span></td><td className="px-3 py-4 text-xs">{new Date(session.expires_at).toLocaleString("ko-KR")}</td><td className="px-3 py-4"><div className="flex flex-wrap gap-2"><button className={button} onClick={() => copy(session.session_code)}>코드 복사</button><button className={button} onClick={() => copy(`${window.location.origin}/session`)}>입장 주소</button><button className={button} onClick={() => { setPresenting(session); presentation.current?.showModal(); }}>크게 보기</button>{active && <button disabled={busy} className={button} onClick={() => changeStatus(session)}>종료</button>}</div></td></tr>;
    })}</tbody></table></div>}
    {loading ? <p className="py-16 text-stone-600">워크숍을 불러오는 중이에요.</p> : sessions.length === 0 ? <div className="my-8 rounded-2xl border border-dashed border-stone-300 p-8 text-center"><h2 className="text-xl font-semibold">첫 워크숍을 열어보세요</h2><p className="mt-3 text-sm text-stone-600">워크숍 이름과 기관명을 입력하면 6자리 참여 코드가 만들어져요.</p></div> : <div className="mt-6 grid gap-6 md:hidden">{sessions.map(session => {
      const expired = Date.parse(session.expires_at) <= now;
      const active = session.status === "ACTIVE" && !expired;
      return <article key={session.id} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4"><p className="text-sm text-stone-600">{session.organization_name}</p><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-600"}`}>{expired ? "만료" : active ? "참여 가능" : "참여 종료"}</span></div>
        <h2 className="mt-3 break-words text-xl font-semibold">{session.title}</h2>
        <p className="mt-6 text-xs text-stone-500">참여 코드</p><p className="select-all break-all font-mono text-4xl font-bold tracking-[0.15em] sm:text-5xl">{session.session_code}</p>
        <p className="mt-4 text-sm leading-6 text-stone-600">정원 {session.max_capacity}명<br />{new Date(session.expires_at).toLocaleString("ko-KR")}까지 참여 가능</p>
        <div className="mt-5 flex flex-wrap gap-2"><button className={button} onClick={() => copy(session.session_code)}>코드 복사</button><button className={button} onClick={() => copy(`${window.location.origin}/session`)}>입장 주소 복사</button><button className={button} onClick={() => { setPresenting(session); presentation.current?.showModal(); }}>크게 보기</button></div>
        {active && <button className={`${button} mt-4 w-full text-stone-700`} disabled={busy} onClick={() => changeStatus(session)}>참여 종료하기</button>}
      </article>;
    })}</div>}
    <dialog ref={dialog} aria-labelledby="create-title" onCancel={event => { if (busy) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-stone-950 backdrop:bg-stone-950/40">
      <h2 id="create-title" className="text-xl font-semibold">새 워크숍 만들기</h2>
      <form onSubmit={create} className="mt-5 space-y-4">
        <label className="block text-sm font-medium">워크숍 이름<input autoFocus required maxLength={100} name="title" className={input} placeholder="청년 퍼스널 브랜딩 워크숍" /></label>
        <label className="block text-sm font-medium">기관명<input required maxLength={100} name="organization" className={input} placeholder="기관 또는 클래스 이름" /></label>
        <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">정원 (명)<input required type="number" min={1} max={500} defaultValue={35} name="capacity" className={input} /></label><label className="block text-sm font-medium">참여 가능 시간<input required type="number" min={1} max={168} defaultValue={24} name="duration" className={input} /></label></div>
        <p className="text-xs leading-5 text-stone-600">생성한 시점부터 설정한 시간 동안 참여할 수 있어요. 기본 24시간이며, 최대 168시간(7일)까지 설정할 수 있어요.</p>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2 pt-3"><button type="button" disabled={busy} className={button} onClick={() => dialog.current?.close()}>취소</button><button disabled={busy} className={`${button} bg-stone-900 text-white hover:bg-stone-700`}>{busy ? "만드는 중…" : "워크숍 만들기"}</button></div>
      </form>
    </dialog>
    <dialog ref={presentation} aria-labelledby="present-title" onClose={() => setPresenting(null)} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-[#f6f2e9] p-6 text-stone-950 open:flex open:flex-col open:items-center open:justify-center">
      <button autoFocus className={`${button} absolute right-5 top-5`} onClick={() => presentation.current?.close()}>닫기</button><h2 id="present-title" className="text-center text-2xl font-semibold">{presenting?.title}</h2><p className="mt-10 font-mono text-[clamp(2.5rem,12vw,10rem)] font-bold tracking-widest">{presenting?.session_code}</p><p className="mt-8 text-center text-lg">My Orbit에서 이 참여 코드를 입력해 주세요.</p><p className="mt-3 text-sm text-stone-600">{presenting && (Date.parse(presenting.expires_at) <= now ? "만료된 워크숍입니다." : presenting.status === "ACTIVE" ? "참여 가능" : "참여가 종료됐습니다.")}</p>
    </dialog>
  </>;
}
