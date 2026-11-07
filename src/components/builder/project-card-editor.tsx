"use client";

import { useState } from "react";
import { cleanProjectLine, projectCardFields, type ProjectCard, type ProjectLine } from "@/lib/builder/project-card";

export default function ProjectCardEditor({ card, onChange, disabled }: {
  card: ProjectCard; onChange: (card: ProjectCard) => void; disabled?: boolean;
}) {
  const [active, setActive] = useState<ProjectLine | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<{ field: ProjectLine; original: string; text: string }>();

  async function rewrite(field: ProjectLine, action: "shorten" | "emphasize_metrics") {
    setRewriting(true);
    setMessage("");
    setProposal(undefined);
    try {
      const response = await fetch("/api/builder/regenerate-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "project_summary", currentText: card[field], action }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.regeneratedText !== "string") throw new Error();
      setProposal({ field, original: card[field], text: cleanProjectLine(result.regeneratedText) });
    } catch {
      setMessage("문구를 다듬지 못했어요. 직접 수정할 수 있어요.");
    } finally {
      setRewriting(false);
    }
  }
  return <fieldset disabled={disabled} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
    <legend className="px-1 text-sm font-semibold">대표 프로젝트 카드</legend>
    <p className="break-words font-semibold">{card.title}</p>
    <p className="mt-1 break-words text-sm text-stone-600">{card.role}</p>
    <div className="mt-4 space-y-3">
      {(Object.keys(projectCardFields) as ProjectLine[]).map(field => <div key={field}>
        <p className="text-xs font-semibold text-amber-900">{projectCardFields[field]}</p>
        {active === field ? <input autoFocus aria-label={projectCardFields[field] + " 편집"}
          className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3 text-sm"
          maxLength={180} value={card[field]} onChange={event => onChange({ ...card, [field]: event.target.value })}
          onBlur={() => setActive(null)} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") { event.preventDefault(); setActive(null); }
          }} /> :
          <button type="button" aria-label={projectCardFields[field] + " 수정"}
            className="mt-1 min-h-11 w-full break-words rounded-lg border border-stone-200 px-3 py-2 text-left text-sm"
            onClick={() => setActive(field)}>{card[field] || "문장을 입력해 주세요."}</button>}
        <button type="button" disabled={rewriting || !card[field].trim()} className="mt-1 min-h-9 rounded px-2 text-xs text-amber-900"
          onClick={() => void rewrite(field, "shorten")}>더 간결하게</button>
        {field === "result_line" && <button type="button" disabled={rewriting || !/\d/.test(card[field])}
          className="mt-1 min-h-9 rounded px-2 text-xs text-amber-900" onClick={() => void rewrite(field, "emphasize_metrics")}>수치 강조</button>}
        {proposal?.field === field && proposal.original === card[field] && <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm">
          <p>{proposal.text}</p>
          <button type="button" className="mt-2 min-h-9 rounded px-2 font-semibold"
            onClick={() => { onChange({ ...card, [field]: proposal.text }); setProposal(undefined); }}>제안 적용</button>
        </div>}
      </div>)}
    </div>
    {(rewriting || message) && <p role="status" className="mt-2 text-sm">{rewriting ? "문구를 다듬고 있어요." : message}</p>}
    <label className="mt-4 block text-sm font-medium">프로젝트 링크 (선택)
      <input type="url" maxLength={2048} placeholder="https://..." value={card.link_url ?? ""}
        className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3 text-sm"
        onChange={event => onChange({ ...card, link_url: event.target.value || null })} />
    </label>
  </fieldset>;
}
