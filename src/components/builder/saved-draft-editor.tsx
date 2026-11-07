"use client";

import ProjectCardEditor from "./project-card-editor";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { editableTextSchema, savedDraftSchema, type EditableText, type SavedDraft } from "@/lib/builder/editable-draft";
import StarObjectGuideViewer from "./star-object-guide-viewer";
import PendingIndicator from "@/components/layouts/pending-indicator";

const button = "min-h-11 rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-amber-700 disabled:opacity-50";
const fieldClass = "w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20";

function EditableBlock({ label, value, original, max, multiline, field, onChange, onPending }: {
  label: string; value: string; original: string; max: number; multiline?: boolean;
  field: "title" | "skill_tag" | "project_summary"; onChange: (value: string) => void; onPending: (pending: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState("professional");
  const [proposal, setProposal] = useState<string | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function commit() {
    if (!text.trim()) { setError("빈 문구는 저장할 수 없어요. 기존 내용을 유지했어요."); setText(value); }
    else { onChange(text.trim()); setError(""); }
    setEditing(false); onPending(false);
  }
  async function rewrite(action: "shorten" | "change_tone") {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); onPending(true); setError(""); setProposal(null);
    try {
      const response = await fetch("/api/builder/regenerate-block", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, currentText: value, action, ...(action === "change_tone" ? { targetTone: tone } : {}) }), signal: request.signal });
      const body = z.object({ success: z.boolean(), regeneratedText: z.string().trim().min(1).max(max).optional(), message: z.string().optional() }).parse(await response.json());
      if (!response.ok || !body.success || !body.regeneratedText) throw new Error(body.message ?? "일시적으로 수정할 수 없습니다. 직접 편집을 이용해 주세요.");
      setProposal(body.regeneratedText);
    } catch (e) {
      if (!request.signal.aborted) setError(e instanceof Error ? e.message : "연결을 확인하고 다시 시도해 주세요.");
    } finally { if (!request.signal.aborted) { setBusy(false); onPending(false); } }
  }
  return <div ref={container} className="min-w-0 space-y-3 border-b border-stone-200 pb-5 last:border-0">
    <p className="text-sm font-semibold text-stone-700">{label}</p>
    {editing ? <div className="space-y-2">
      {multiline ? <textarea autoFocus aria-label={`${label} 편집`} rows={5} maxLength={max} className={fieldClass} value={text} onChange={e => setText(e.target.value)} onBlur={e => { if (!container.current?.contains(e.relatedTarget)) commit(); }} onKeyDown={e => { if (e.key === "Escape") { setEditing(false); onPending(false); } }} /> :
        <input autoFocus aria-label={`${label} 편집`} maxLength={max} className={fieldClass} value={text} onChange={e => setText(e.target.value)} onBlur={e => { if (!container.current?.contains(e.relatedTarget)) commit(); }} onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setEditing(false); onPending(false); } }} />}
      <p className="text-xs text-stone-500">{text.length} / {max}자</p>
      <div className="flex gap-2"><button type="button" className={button} onClick={commit}>확인</button><button type="button" className={button} onClick={() => { setEditing(false); onPending(false); }}>취소</button></div>
    </div> : <button type="button" disabled={busy} aria-label={`${label} 직접 수정`} className={`${fieldClass} min-h-11 whitespace-pre-wrap break-words text-left leading-7 enabled:hover:border-amber-700 ${busy ? "motion-safe:animate-pulse" : ""}`} onClick={() => { setText(value); setEditing(true); setProposal(null); setError(""); onPending(true); }}>{value}</button>}
    {!editing && <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy || value.length < 4} className={button} onClick={() => void rewrite("shorten")}>{busy ? "다듬는 중…" : "더 짧게"}</button>
      <select disabled={busy} aria-label={`${label} 변경할 말투`} className={`${button} max-w-full bg-white`} value={tone} onChange={e => setTone(e.target.value)}><option value="professional">전문적으로</option><option value="bold">도전적으로</option><option value="approachable">친근하게</option></select>
      <button type="button" disabled={busy} className={button} onClick={() => void rewrite("change_tone")}>톤 변경</button>
      {value !== original && <button type="button" disabled={busy} className={button} onClick={() => { onChange(original); setProposal(null); setError(""); }}>생성 원문으로</button>}
    </div>}
    {proposal && <div aria-live="polite" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold">AI 수정 제안</p><p className="whitespace-pre-wrap break-words leading-7">{proposal}</p><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => { onChange(proposal); setProposal(null); }}>적용</button><button type="button" className={button} onClick={() => setProposal(null)}>원래대로 취소</button></div></div>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </div>;
}

function DraftEditor({ draft, onEditingChange }: { draft: SavedDraft; onEditingChange: (value: boolean) => void }) {
  const [current, setCurrent] = useState(draft.current);
  const [saved, setSaved] = useState(draft.current);
  const [version, setVersion] = useState(draft.updatedAt);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const dirty = JSON.stringify(current) !== JSON.stringify(saved);
  const blocked = busy || Object.values(pending).some(Boolean);
  useEffect(() => { onEditingChange(dirty || blocked); return () => onEditingChange(false); }, [dirty, blocked, onEditingChange]);
  const storageKey = `orbit.editable:${draft.id}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = z.object({ version: z.string(), current: editableTextSchema }).safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.version === draft.updatedAt) { const restored = parsed.data.current; queueMicrotask(() => { setCurrent(restored); setMessage("이 탭의 저장하지 않은 수정 내용을 복원했어요."); }); }
    } catch { queueMicrotask(() => setMessage("임시 저장을 이용할 수 없어요. 화면을 나가기 전에 저장해 주세요.")); }
  }, [storageKey, draft.updatedAt]);
  useEffect(() => {
    if (!dirty) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ version, current })); }
    catch { /* DB save and the unsaved indicator remain available. */ }
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [current, dirty, storageKey, version]);
  function update(patch: Partial<EditableText>) { setCurrent(value => ({ ...value, ...patch })); setMessage(""); setFailed(false); }
  async function save() {
    if (blocked || !dirty) return;
    if (!editableTextSchema.safeParse(current).success) {
      setMessage("카드의 세 문장과 링크를 확인해 주세요.");
      return;
    }
    setBusy(true); setMessage(""); setFailed(false);
    const snapshot = current;
    try {
      const response = await fetch("/api/builder/draft", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draft.id, updatedAt: version, current: snapshot }) });
      const result = z.object({ success: z.boolean(), updatedAt: z.string().optional(), message: z.string().optional() }).parse(await response.json());
      if (!response.ok || !result.success || !result.updatedAt) throw new Error(result.message ?? "저장하지 못했어요. 다시 시도해 주세요.");
      setVersion(result.updatedAt); setSaved(snapshot); setMessage("수정한 초안을 계정에 저장했어요.");
      try { sessionStorage.removeItem(storageKey); } catch { /* The DB save succeeded; stale browser copies are version checked. */ }
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "연결을 확인해 주세요. 수정 내용은 유지됩니다."); }
    finally { setBusy(false); }
  }
  const blockProps = (key: string) => ({ onPending: (value: boolean) => setPending(previous => ({ ...previous, [key]: value })) });
  return <div className="space-y-5">
    {busy && <PendingIndicator message="수정한 초안을 저장하고 있어요." overlay />}
    <div className={`space-y-5 ${busy ? "pointer-events-none opacity-60" : ""}`} inert={busy}>
      <EditableBlock label="한 줄 소개" field="title" max={60} value={current.headline} original={draft.original.headline} onChange={headline => update({ headline })} {...blockProps("headline")} />
      <div className="grid min-w-0 gap-5 lg:grid-cols-3">{current.competency_tags.map((value, index) => <EditableBlock key={index} label={`핵심 역량 ${index + 1}`} field="skill_tag" max={20} value={value} original={draft.original.competency_tags[index]} onChange={tag => update({ competency_tags: current.competency_tags.map((item, i) => i === index ? tag : item) })} {...blockProps(`tag${index}`)} />)}</div>
      {current.project_card ? <ProjectCardEditor card={current.project_card} disabled={busy} onChange={project_card => update({ project_card })} /> : <EditableBlock label="프로젝트 요약" field="project_summary" multiline max={300} value={current.project_summary} original={draft.original.project_summary} onChange={project_summary => update({ project_summary })} {...blockProps("summary")} />}
    </div>
    {draft.objectGuide && <StarObjectGuideViewer guide={draft.objectGuide} />}
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={blocked || !dirty} className={`${button} bg-stone-900 text-white`} onClick={() => void save()}>{busy ? "저장 중…" : "수정한 초안 저장"}</button><p className="text-sm text-stone-600">{dirty ? "저장하지 않은 수정 내용이 있어요." : "계정에 저장된 초안이에요."}</p></div>
    {dirty || blocked ? <p className="text-sm text-stone-600">편집을 마치고 저장하면 미리볼 수 있어요.</p> :
      <form action="/builder/preview" method="get"><button type="submit" className={button}>미리보기</button></form>}
    {message && <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-red-800" : "text-sm text-stone-700"}>{message}</p>}
  </div>;
}

const ignoreEditingChange = () => {};

export default function SavedDraftEditor({ workshopSessionId, revision, locked, onEditingChange = ignoreEditingChange }: { workshopSessionId: string | null; revision: number; locked: boolean; onEditingChange?: (value: boolean) => void }) {
  const [draft, setDraft] = useState<SavedDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const query = workshopSessionId ? `?workshopSessionId=${encodeURIComponent(workshopSessionId)}` : "";
        const response = await fetch(`/api/builder/draft${query}`, { signal: controller.signal, cache: "no-store" });
        const result = z.object({ success: z.boolean(), draft: savedDraftSchema.nullable().optional(), message: z.string().optional() }).parse(await response.json());
        if (!response.ok || !result.success || result.draft === undefined) throw new Error(result.message ?? "저장된 초안을 불러오지 못했어요.");
        setDraft(result.draft);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "연결을 확인하고 다시 시도해 주세요."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [workshopSessionId, revision, retry]);
  return <section aria-label="저장된 프로필 초안 편집" className="mt-8 min-w-0 scroll-mt-24 space-y-5 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-6">
    <div><h2 className="text-xl font-semibold">내 말로 다듬기</h2><p className="mt-2 text-sm leading-6 text-stone-600">문구를 누르면 직접 고칠 수 있어요. AI 제안은 적용한 후 저장해 주세요. 저장된 초안은 다시 열어도 유지됩니다.</p></div>
    {locked && <p role="status" className="text-sm text-stone-600">새 초안을 만드는 동안 편집은 잠시 기다려 주세요.</p>}
    <div inert={locked} className={locked ? "opacity-60" : ""}>{loading ? <p role="status">저장된 초안을 불러오고 있어요.</p> : error ? <div><p role="alert" className="text-sm text-red-800">{error}</p><button type="button" className={`${button} mt-3`} onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div> : draft ? <DraftEditor key={`${draft.id}:${draft.updatedAt}`} draft={draft} onEditingChange={onEditingChange} /> : <p className="text-sm text-stone-600">아직 저장된 초안이 없어요. 위 질문에 답하고 초안을 먼저 만들어 주세요.</p>}</div>
  </section>;
}
