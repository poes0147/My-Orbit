"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { MAX_RESUME_BYTES, resumeAnalysisSchema, resumeTextSchema, type ResumeAnalysis, type resumeToWizard } from "@/lib/builder/resume-schema";
import ResumeAnalysisPreviewModal from "./resume-analysis-preview-modal";

const button = "min-h-11 rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-amber-700 disabled:opacity-50";
export default function ResumeUploader({ hasExisting, onApply }: { hasExisting: boolean; onApply: (values: ReturnType<typeof resumeToWizard>) => void }) {
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const controller = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function selectFile(next: File | null) {
    setMessage(""); setFile(null);
    if (!next) return;
    if (next.type !== "application/pdf" || next.size > MAX_RESUME_BYTES || !next.size) { setMessage("텍스트가 있는 PDF 파일을 4MB 이하로 선택해 주세요."); return; }
    setFile(next);
  }
  function cancel() { controller.current?.abort(); setBusy(false); setMessage("분석을 취소했어요. 직접 입력을 이어갈 수 있어요."); }
  async function analyze() {
    if (busy || !consent) return;
    if (mode === "pdf" && !file) { setMessage("PDF 파일을 선택해 주세요."); return; }
    if (mode === "text" && !resumeTextSchema.safeParse(rawText).success) { setMessage("텍스트를 50~8,000자 이내로 입력해 주세요."); return; }
    const request = new AbortController(); controller.current = request;
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); if (file) form.append("file", file);
      const response = await fetch("/api/builder/parse-resume", { method: "POST", signal: request.signal,
        ...(mode === "pdf" ? { body: form } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw_text: rawText }) }) });
      const result = z.object({ success: z.boolean(), data: resumeAnalysisSchema.optional(), code: z.string().optional(), message: z.string().optional() }).safeParse(await response.json());
      if (request.signal.aborted || controller.current !== request) return;
      if (!result.success) { setMessage("분석 결과를 읽지 못했어요. 다시 시도하거나 직접 입력해 주세요."); return; }
      if (!response.ok || !result.data.success || !result.data.data) { setMessage(result.data.message ?? "분석하지 못했어요. 잠시 후 다시 시도해 주세요."); if (result.data.code === "NO_TEXT_FOUND") setMode("text"); return; }
      setAnalysis(result.data.data);
      // The local source is only needed for this request, not for profile editing.
      setFile(null); setRawText("");
    } catch { if (!request.signal.aborted) setMessage("연결이 원활하지 않아요. 다시 시도하거나 직접 입력을 이어가세요."); }
    finally { if (controller.current === request) { controller.current = null; setBusy(false); } }
  }
  return <>
    <details ref={panel} className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5" onToggle={event => { if (!event.currentTarget.open && busy) cancel(); }}>
      <summary className="min-h-11 cursor-pointer text-sm font-semibold leading-7">이력서로 빠르게 채우기 · PDF 또는 텍스트</summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-stone-600">이미 적어둔 경험을 가져와 시작할 수 있어요. 분석 결과를 확인한 뒤 적용하며, 가치관과 소개 말투는 직접 선택합니다.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="이력서 입력 방식"><button type="button" disabled={busy} aria-pressed={mode === "pdf"} className={`${button} ${mode === "pdf" ? "bg-stone-900 text-white" : "bg-white"}`} onClick={() => setMode("pdf")}>PDF 파일</button><button type="button" disabled={busy} aria-pressed={mode === "text"} className={`${button} ${mode === "text" ? "bg-stone-900 text-white" : "bg-white"}`} onClick={() => setMode("text")}>텍스트 붙여넣기</button></div>
        {mode === "pdf" ? <div className="rounded-xl border border-dashed border-stone-400 bg-white p-4" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) selectFile(event.dataTransfer.files[0] ?? null); }}><label className="block text-sm font-semibold">이력서 PDF 파일<input disabled={busy} type="file" accept="application/pdf,.pdf" className="mt-3 block min-h-11 w-full min-w-0 text-sm file:mr-2 file:rounded-lg file:border file:border-stone-300 file:bg-white file:px-3 file:py-3" onChange={event => { selectFile(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label><p className="mt-3 text-xs leading-6 text-stone-600">파일을 끌어 놓거나 선택해 주세요. 4MB·5페이지 이하, 글자를 복사할 수 있는 PDF만 지원해요. 스캔본은 텍스트를 직접 붙여넣어 주세요.</p>{file && <p className="mt-2 break-words text-sm">선택: {file.name}</p>}</div> : <label className="block text-sm font-semibold">이력서 텍스트<textarea disabled={busy} aria-describedby="resume-text-limit" rows={7} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20" value={rawText} onChange={event => setRawText(event.target.value)} /><span id="resume-text-limit" className={`mt-1 block text-xs font-normal ${rawText.length > 8000 ? "text-red-800" : "text-stone-500"}`}>{rawText.length.toLocaleString()} / 8,000자 · 최소 50자{rawText.length > 8000 ? " · 길이를 줄여 주세요." : ""}</span></label>}
        <p className="text-xs leading-6 text-stone-600">원본 파일과 추출한 본문은 서버에 보관하지 않고 메모리에서 처리해요. 분석 결과는 비공개로 24시간 임시 보관 후 만료·정리합니다. 직접 적용하거나 저장한 프로필 내용은 별도로 유지됩니다.</p>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6"><input disabled={busy} type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>분석을 위해 이력서 텍스트가 OpenAI API로 전송되는 것을 확인했어요.</span></label>
        {busy && <p role="status" className="text-sm text-stone-700 motion-safe:animate-pulse">이력서에서 핵심 경험과 프로젝트를 정리하고 있어요. 최대 20초 정도 걸릴 수 있습니다.</p>}
        {message && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">{message}</p>}
        <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || !consent || (mode === "pdf" ? !file : !resumeTextSchema.safeParse(rawText).success)} className={`${button} bg-stone-900 text-white`} onClick={() => void analyze()}>{busy ? "분석 중…" : "이력서 분석 및 채우기"}</button>{busy ? <button type="button" className={button} onClick={cancel}>분석 취소</button> : <button type="button" className={button} onClick={() => { if (panel.current) panel.current.open = false; document.getElementById("experience")?.focus(); }}>직접 입력하기</button>}</div>
      </div>
    </details>
    {analysis && <ResumeAnalysisPreviewModal analysis={analysis} hasExisting={hasExisting} onClose={() => setAnalysis(null)} onApply={values => { onApply(values); setAnalysis(null); if (panel.current) panel.current.open = false; }} />}
  </>;
}
