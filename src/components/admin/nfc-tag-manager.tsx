"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Tag = { tagId: string; fixedUrl: string; bindUrl: string; isActive: boolean; isRegistered: boolean; createdAt: string; registeredAt: string | null };
type Issued = Pick<Tag, "tagId" | "fixedUrl" | "bindUrl" | "createdAt"> & { registrationCode: string | null; replayed: boolean };
const button = "min-h-11 rounded-lg border border-admin-border px-4 py-2 text-sm font-semibold hover:bg-admin-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent disabled:cursor-not-allowed disabled:opacity-50";
const date = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR") : "—";

function CopyValue({ label, value }: { label: string; value: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} 복사 완료`); }
    catch { setMessage("복사하지 못했어요. 아래 내용을 직접 선택해 복사해 주세요."); }
  }
  return <div className="min-w-0 space-y-2">
    <p className="text-sm font-semibold">{label}</p>
    <p className="select-all break-all rounded-lg bg-admin-canvas p-3 text-sm">{value}</p>
    <button type="button" className={button} onClick={copy}>{label} 복사</button>
    <p role="status" className="text-sm text-admin-muted">{message}</p>
  </div>;
}

export default function NfcTagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [issueError, setIssueError] = useState("");
  const [pending, setPending] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const requestKey = useRef<string | null>(null);
  const issuing = useRef(false);
  const listSequence = useRef(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const issueButton = useRef<HTMLButtonElement>(null);
  const needsLeaveWarning = !!issued || !!issueError || pending;

  const load = useCallback(async (nextPage: number) => {
    const sequence = ++listSequence.current;
    try {
      const response = await fetch(`/api/admin/nfc-tags?page=${nextPage}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "태그 목록을 불러오지 못했어요.");
      if (sequence !== listSequence.current) return;
      setTags(result.data.tags); setTotal(result.data.pagination.total); setListError("");
    } catch (error) { if (sequence === listSequence.current) setListError(error instanceof Error ? error.message : "목록을 불러오지 못했어요. 다시 시도해 주세요."); }
    finally { if (sequence === listSequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void load(page); });
    return () => { cancelled = true; };
  }, [load, page]);
  function reload(nextPage = page) { setLoading(true); setListError(""); if (nextPage !== page) setPage(nextPage); else void load(page); }
  useEffect(() => {
    if (!needsLeaveWarning) return;
    // Same-URL history entry lets Back ask before the router unmounts this view.
    const marker = "orbitNfcIssueGuard";
    const markerValue = crypto.randomUUID();
    const guardedState = { ...history.state, [marker]: markerValue };
    history.pushState(guardedState, "", location.href);
    let leaving = false;
    const message = "화면을 나가면 등록 코드나 발급 확인 정보가 사라져요. 필요한 내용을 기록했으며 이동하시겠어요?";
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const back = (event: PopStateEvent) => {
      if (leaving || event.state?.[marker] === markerValue) return;
      event.stopImmediatePropagation();
      if (window.confirm(message)) { leaving = true; history.back(); }
      else history.pushState(guardedState, "", location.href);
    };
    const confirmNavigation = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.getAttribute("target") === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!window.confirm(message)) {
        event.preventDefault(); event.stopPropagation();
      } else leaving = true;
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", confirmNavigation, true);
    window.addEventListener("popstate", back, true);
    return () => {
      window.removeEventListener("beforeunload", warn); document.removeEventListener("click", confirmNavigation, true); window.removeEventListener("popstate", back, true);
      if (!leaving && history.state?.[marker] === markerValue) history.back();
    };
  }, [needsLeaveWarning]);
  useEffect(() => { if (issued) resultHeading.current?.focus(); }, [issued]);

  async function issue() {
    if (issuing.current || issued) return;
    issuing.current = true; setPending(true); setIssueError("");
    try {
      requestKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/admin/nfc-tags/issue", { method: "POST", headers: { "Idempotency-Key": requestKey.current } });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "발급 결과를 확인하지 못했어요.");
      setIssued(result.data); setAcknowledged(false); requestKey.current = null;
      reload(1);
    } catch (error) { setIssueError(error instanceof Error ? error.message : "발급 결과를 확인하지 못했어요."); }
    finally { issuing.current = false; setPending(false); }
  }

  return <div className="mt-6 min-w-0 space-y-6">
    <div className="rounded-2xl border border-admin-border bg-admin-surface p-4 sm:p-6">
      <p className="text-sm leading-7 text-admin-muted">태그 ID는 NFC 칩 제조 일련번호(UID)와 다른 서비스 식별자예요. 칩에는 ‘NFC 기록용 URL’만 쓰고, 등록 링크와 등록 코드는 사용자에게 따로 전달하세요.</p>
      <button ref={issueButton} type="button" className={`${button} mt-4 bg-admin-selected text-admin-accent`} disabled={pending || loading || !!issued} onClick={issue}>
        {pending ? "발급 결과 확인 중…" : issueError ? "같은 발급 요청 다시 확인" : "새 태그 발급"}
      </button>
      <p role="status" className="mt-2 text-sm text-admin-muted">{pending ? "잠시 기다려 주세요. 태그를 중복 발급하지 않고 확인하고 있어요." : "한 번에 태그 1개를 발급합니다."}</p>
      {issueError && <div role="alert" className="mt-4 text-sm leading-7"><p>{issueError}</p><p>이미 발급됐을 수도 있어요. 위 버튼으로 같은 요청을 다시 확인하세요. 응답이 유실됐다면 등록 코드는 복구할 수 없어요.</p></div>}
    </div>

    {issued && <section aria-labelledby="issued-heading" className="min-w-0 space-y-5 rounded-2xl border border-admin-accent bg-admin-surface p-4 sm:p-6">
      <h2 ref={resultHeading} tabIndex={-1} id="issued-heading" className="text-xl font-semibold">{issued.replayed ? "이미 발급된 태그 확인" : "태그 발급 완료"}</h2>
      <p className="break-all text-sm">태그 ID: {issued.tagId}</p>
      <CopyValue label="NFC 기록용 URL" value={issued.fixedUrl} />
      <CopyValue label="사용자 등록 링크" value={issued.bindUrl} />
      {issued.registrationCode ? <CopyValue label="일회용 등록 코드" value={issued.registrationCode} /> : <p role="alert" className="text-sm leading-7">이 요청은 이미 처리됐어요. 등록 코드는 최초 발급 응답에서만 표시되며 복구할 수 없습니다. 코드를 기록하지 못했다면 이 태그를 배포하지 말고 새 태그를 발급해 주세요.</p>}
      <p className="text-sm leading-7">등록 코드는 이 결과를 닫거나 화면을 이동하면 다시 볼 수 없어요. 링크에 코드를 붙이지 말고 따로 안전하게 보관·전달해 주세요.</p>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />{issued.registrationCode ? "등록 코드를 안전하게 기록했어요." : "코드 유실 안내를 확인했어요."}</label>
      <button type="button" className={button} disabled={!acknowledged} onClick={() => { setIssued(null); setAcknowledged(false); requestAnimationFrame(() => issueButton.current?.focus()); }}>발급 결과 닫기</button>
    </section>}

    <section aria-labelledby="tag-list-heading" aria-busy={loading} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="tag-list-heading" className="text-xl font-semibold">발급된 태그 {total > 0 && `(${total})`}</h2><button type="button" className={button} disabled={loading} onClick={() => reload()}>목록 새로고침</button></div>
      {loading ? <div role="status" className="rounded-xl bg-admin-hover p-6 motion-safe:animate-pulse">태그 목록을 불러오고 있어요.</div>
        : listError ? <div role="alert" className="space-y-3"><p>{listError}</p><button className={button} onClick={() => reload()}>다시 시도</button></div>
        : !tags.length ? <p className="rounded-xl border border-admin-border p-6">발급된 NFC 태그가 없습니다. ‘새 태그 발급’ 버튼으로 첫 태그를 만들어 주세요.</p>
        : <div role="table" aria-label="NFC 태그 목록" className="min-w-0 space-y-3 lg:space-y-0">
          <div role="row" className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 bg-admin-hover p-4 text-sm font-semibold lg:grid">{["태그·링크", "등록 상태", "활성 상태", "발급 일시", "등록 일시"].map(label => <span role="columnheader" key={label}>{label}</span>)}</div>
          {tags.map(tag => <div role="row" key={tag.tagId} className="grid min-w-0 gap-4 rounded-xl border border-admin-border bg-admin-surface p-4 text-sm lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] lg:rounded-none">
            <div role="cell" className="min-w-0 space-y-3"><p className="break-all font-semibold">{tag.tagId}</p><details><summary className="flex min-h-11 cursor-pointer items-center text-admin-accent underline">링크 확인·복사</summary><div className="space-y-3"><CopyValue label="NFC 기록용 URL" value={tag.fixedUrl} /><CopyValue label="사용자 등록 링크" value={tag.bindUrl} /></div></details></div>
            <p role="cell"><span className="lg:hidden">등록 상태: </span>{tag.isRegistered ? "등록 완료" : "미등록"}</p>
            <p role="cell"><span className="lg:hidden">활성 상태: </span>{tag.isActive ? "활성" : "비활성"}</p>
            <p role="cell"><span className="lg:hidden">발급 일시: </span>{date(tag.createdAt)}</p>
            <p role="cell"><span className="lg:hidden">등록 일시: </span>{date(tag.registeredAt)}</p>
          </div>)}
        </div>}
      <div className="mt-4 flex items-center justify-between gap-3"><button className={button} disabled={loading || page === 1} onClick={() => reload(page - 1)}>이전</button><span className="text-sm">{page} 페이지</span><button className={button} disabled={loading || page * 20 >= total} onClick={() => reload(page + 1)}>다음</button></div>
    </section>
  </div>;
}
