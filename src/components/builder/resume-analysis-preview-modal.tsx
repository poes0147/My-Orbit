"use client";

import { useEffect, useId, useRef, useState } from "react";
import { resumeToWizard, type ResumeAnalysis, type ResumeProject } from "@/lib/builder/resume-schema";

const button = "min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-amber-700 disabled:opacity-50";
const inputClass = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20";

export default function ResumeAnalysisPreviewModal({ analysis, hasExisting, onApply, onClose }: {
  analysis: ResumeAnalysis; hasExisting: boolean; onApply: (values: ReturnType<typeof resumeToWizard>) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const [data, setData] = useState(analysis);
  const [selected, setSelected] = useState(Math.max(0, analysis.projects.findIndex(project => project.is_primary)));
  const [keyword, setKeyword] = useState("");
  const [keywordError, setKeywordError] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => { if (overwrite) confirm.current?.focus(); }, [overwrite]);
  const project = data.projects[selected];
  function changeProject(field: keyof Pick<ResumeProject, "project_name" | "role" | "situation" | "action" | "result_outcome">, value: string) {
    setData(previous => ({ ...previous, projects: previous.projects.map((item, index) => index === selected ? { ...item, [field]: value } : item) }));
  }
  function apply() { onApply(resumeToWizard(data.primary_experience.category, data.primary_experience.keywords, project)); }
  function addKeyword() {
    const value = keyword.trim();
    if (!value || value.length > 40 || data.primary_experience.keywords.length >= 5 || data.primary_experience.keywords.includes(value)) { setKeywordError("중복되지 않는 키워드를 40자 이내, 최대 5개로 입력해 주세요."); return; }
    setData(previous => ({ ...previous, primary_experience: { ...previous.primary_experience, keywords: [...previous.primary_experience.keywords, value] } })); setKeyword(""); setKeywordError("");
  }
  return <dialog ref={dialog} role={overwrite ? "alertdialog" : undefined} aria-labelledby={headingId} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-stone-200 bg-white p-4 text-stone-950 shadow-xl backdrop:bg-stone-950/40 sm:p-6">
    <h2 id={headingId} className="text-xl font-semibold">{overwrite ? "기존 입력을 바꿀까요?" : "이력서 분석 결과 확인"}</h2>
    {overwrite ? <div className="mt-4 space-y-5"><p className="text-sm leading-7">기존에 작성 중이던 경험·역할·성과가 이 내용으로 대체됩니다. 가치관과 소개 말투는 유지돼요.</p><div className="flex flex-col gap-3 sm:flex-row"><button ref={confirm} type="button" className={`${button} bg-stone-900 text-white`} onClick={apply}>기존 입력을 바꾸고 적용</button><button type="button" className={button} onClick={() => setOverwrite(false)}>분석 결과로 돌아가기</button></div></div> : <div className="mt-4 space-y-6">
      <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">문서에서 확인되지 않은 항목은 비어 있어요. 내용을 확인하고 직접 보완해 주세요. 적용 전까지 기존 입력은 바뀌지 않습니다.</p>
      <label className="block text-sm font-semibold">경험 분야<input className={inputClass} maxLength={120} value={data.primary_experience.category} onChange={event => setData(previous => ({ ...previous, primary_experience: { ...previous.primary_experience, category: event.target.value } }))} /></label>
      <fieldset><legend className="text-sm font-semibold">핵심 키워드 · 최대 5개</legend><ul className="mt-2 flex flex-wrap gap-2">{data.primary_experience.keywords.map((value, index) => <li key={`${value}:${index}`}><button type="button" aria-label={`${value} 키워드 삭제`} className={`${button} break-words`} onClick={() => setData(previous => ({ ...previous, primary_experience: { ...previous.primary_experience, keywords: previous.primary_experience.keywords.filter((_, i) => i !== index) } }))}>{value} ×</button></li>)}</ul>
        <div className="mt-3 flex flex-wrap gap-2"><input aria-label="추가할 키워드" className={`${inputClass} min-w-0 flex-1 basis-36`} maxLength={40} value={keyword} onChange={event => setKeyword(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addKeyword(); } }} /><button type="button" className={`${button} mt-2`} onClick={addKeyword}>키워드 추가</button></div>{keywordError && <p role="alert" className="mt-2 text-sm text-red-800">{keywordError}</p>}
      </fieldset>
      {data.projects.length > 1 && <fieldset><legend className="text-sm font-semibold">프로필에 쓸 대표 경험 하나를 골라 주세요</legend><div className="mt-3 space-y-2">{data.projects.map((item, index) => <label key={item.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 p-3 text-sm"><input type="radio" name={`${headingId}-project`} checked={index === selected} onChange={() => setSelected(index)} /><span className="min-w-0 break-words">{item.project_name || `경험 ${index + 1}`}{item.is_primary ? " · 추천" : ""}</span></label>)}</div></fieldset>}
      <div className="grid gap-5 sm:grid-cols-2">{([
        ["project_name", "경험 또는 프로젝트명", 120], ["role", "나의 역할과 목표", 500], ["situation", "상황과 문제", 500], ["action", "내가 한 행동", 500], ["result_outcome", "성과와 배운 점", 500],
      ] as const).map(([field, label, max]) => <label key={field} className={`block min-w-0 text-sm font-semibold ${field === "result_outcome" ? "sm:col-span-2" : ""}`}>{label}<textarea aria-label={`분석 결과 ${label}`} rows={field === "project_name" ? 2 : 4} className={inputClass} maxLength={max} value={project[field]} onChange={event => changeProject(field, event.target.value)} /><span className="mt-1 block text-xs font-normal text-stone-500">{project[field].length} / {max}자{!project[field].trim() ? " · 문서에서 확인되지 않았어요. 직접 보완할 수 있어요." : ""}</span></label>)}</div>
      {data.unmapped_notes.length > 0 && <ul className="list-inside list-disc space-y-2 text-sm leading-6 text-stone-600">{data.unmapped_notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
      <p className="text-sm text-stone-600">가치관과 소개 말투는 3단계에서 직접 골라 주세요.</p>
      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-stone-200 bg-white py-3 sm:flex-row"><button type="button" className={`${button} bg-stone-900 text-white`} onClick={() => hasExisting ? setOverwrite(true) : apply()}>입력폼에 적용하기</button><button type="button" className={button} onClick={onClose}>취소</button></div>
    </div>}
  </dialog>;
}
