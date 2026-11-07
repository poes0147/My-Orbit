"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import SavedDraftEditor from "./saved-draft-editor";
import StarObjectGuideViewer from "./star-object-guide-viewer";
import PendingIndicator from "@/components/layouts/pending-indicator";
import { profileGenerationSchema } from "@/lib/builder/profile-generation";
import ProjectCardEditor from "./project-card-editor";
import { projectCardSchema, type ProjectCard } from "@/lib/builder/project-card";
import ResumeUploader from "./resume-uploader";
import { useWorkspace } from "@/components/layouts/workspace-shell";
import { useFeedback } from "@/components/layouts/feedback-provider";
import { initialDraft, validateDraft, restoreDraft, createWizardPayload, toneOptions, valueOptions, type Draft, type DraftErrors, type WizardPayload } from "@/lib/builder/draft";
import { useProfileStream } from "@/lib/builder/use-profile-stream";

const steps = ["경험 키워드", "역할과 성과", "가치관과 소개 톤"];
const values = valueOptions;
type Field = Exclude<keyof Draft, "values" | "tone">;
type Errors = DraftErrors;

export default function ProfileWizard({ onSubmitDraft }: { onSubmitDraft?: (payload: WizardPayload) => void } = {}) {
  const context = useWorkspace();
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const onSaved = useCallback(() => setRevision(value => value + 1), []);
  return <><WizardForm key={`${context.id}:${context.workshop?.sessionId ?? "personal"}`} storageKey={`orbit.wizard:${context.id}:${context.workshop?.sessionId ?? "personal"}`} workshopSessionId={context.workshop?.sessionId ?? null} onSubmitDraft={onSubmitDraft} onSaved={onSaved} editing={editing} onGenerating={setGenerating} /><SavedDraftEditor key={`editor:${context.id}:${context.workshop?.sessionId ?? "personal"}`} workshopSessionId={context.workshop?.sessionId ?? null} revision={revision} locked={generating} onEditingChange={setEditing} /></>;
}

function WizardForm({ storageKey, workshopSessionId, onSubmitDraft, onSaved, editing, onGenerating }: { storageKey: string; workshopSessionId: string | null; onSubmitDraft?: (payload: WizardPayload) => void; onSaved: () => void; editing: boolean; onGenerating: (value: boolean) => void }) {
  const notify = useFeedback();
  const generation = useProfileStream();
  const completeGuide = profileGenerationSchema.shape.object_guide.safeParse(generation.profile.object_guide);
  useEffect(() => { onGenerating(generation.status === "streaming"); return () => onGenerating(false); }, [generation.status, onGenerating]);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [projectCardDraft, setProjectCardDraft] = useState<{ source: string; card: ProjectCard }>();
  const [cardBusy, setCardBusy] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const cardInput = { project_name: draft.experience.trim(), role: draft.role.trim(), raw_problem: draft.situation.trim(), raw_action: draft.action.trim(), raw_result: draft.result.trim() };
  const cardSource = JSON.stringify(cardInput);
  const currentCard = projectCardDraft?.source === cardSource ? projectCardDraft.card : undefined;
  const [step, setStep] = useState(0);
  const [review, setReview] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [restored, setRestored] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const submitted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => { if (generation.saved) onSaved(); }, [generation.saved, onSaved]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        const raw = sessionStorage.getItem(storageKey);
        const saved = restoreDraft(raw);
        if (saved) {
          setDraft(saved.draft); setStep(saved.step); setReview(saved.review);
          const card = projectCardSchema.safeParse(saved.projectCardDraft?.card);
          if (card.success && saved.projectCardDraft) setProjectCardDraft({ source: saved.projectCardDraft.source, card: card.data });
        }
        else if (raw) { sessionStorage.removeItem(storageKey); setStorageMessage("임시 저장 내용을 읽지 못해 새로 시작했어요."); }
      } catch { setStorageMessage("이 브라우저는 임시 저장을 허용하지 않아요. 화면을 나가기 전에 내용을 따로 보관해 주세요."); }
      setRestored(true);
    });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, draft, step, review, projectCardDraft })); }
    catch { Promise.resolve().then(() => setStorageMessage("임시 저장 공간이 부족하거나 차단됐어요. 화면을 나가기 전에 내용을 따로 보관해 주세요.")); }
  }, [draft, step, review, projectCardDraft, restored, storageKey]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
  }, [step, review]);

  function moveTo(next: number) {
    generation.cancel();
    submitted.current = false;
    setErrors({});
    setReview(false);
    setStep(next);
  }

  async function generateCard() {
    const nextErrors = validateDraft(draft, 1);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    setCardBusy(true);
    setCardMessage("");
    try {
      const response = await fetch("/api/builder/project-card", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: cardSource,
      });
      const result = response.ok
        ? JSON.parse((await response.text()).split("\n").filter(line => line.startsWith("data: ")).at(-1)?.slice(6) ?? "{}")
        : await response.json();
      const parsed = projectCardSchema.safeParse(result.data);
      if (!response.ok || !parsed.success) throw new Error(result.message ?? "카드를 만들지 못했어요.");
      setProjectCardDraft({ source: cardSource, card: { ...parsed.data, link_url: currentCard?.link_url ?? null } });
      setCardMessage(result.source === "fallback" ? "입력한 내용으로 기본 카드를 만들었어요." : "AI가 프로젝트 카드 초안을 만들었어요.");
    } catch (error) {
      setCardMessage(error instanceof Error ? error.message : "카드를 만들지 못했어요.");
    } finally {
      setCardBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cardBusy) return;
    const nextErrors = validateDraft(draft, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    if (step === 1 && currentCard && !projectCardSchema.safeParse(currentCard).success) {
      setCardMessage("카드의 세 문장과 http 또는 https 링크를 확인해 주세요.");
      return;
    }
    if (step < 2) moveTo(step + 1);
    else {
      for (let index = 0; index < 3; index++) {
        const allErrors = validateDraft(draft, index);
        if (Object.keys(allErrors).length) { moveTo(index); setErrors(allErrors); return; }
      }
      if (!submitted.current) { onSubmitDraft?.(createWizardPayload(draft, workshopSessionId, currentCard)); submitted.current = true; }
      setReview(true);
      notify("입력 내용을 확인했어요. 아직 계정 DB에는 저장되지 않았어요.");
    }
  }

  function field(name: Field, label: string, hint: string, limit = 500, multiline = true) {
    const props = {
      id: name, name, value: draft[name], maxLength: limit, required: true,
      "aria-invalid": Boolean(errors[name]), "aria-describedby": `${name}-hint${errors[name] ? ` ${name}-error` : ""}`,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setDraft(previous => ({ ...previous, [name]: event.target.value }));
        setErrors(previous => ({ ...previous, [name]: undefined }));
      },
      className: "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20 aria-invalid:border-red-700",
    };
    return <div>
      <label htmlFor={name} className="text-sm font-semibold">{label} <span className="font-normal text-stone-500">(필수)</span></label>
      <p id={`${name}-hint`} className="mt-1 text-sm leading-6 text-stone-500">{hint}</p>
      {multiline ? <textarea {...props} rows={4} /> : <input {...props} type="text" />}
      <div className="mt-1 flex justify-between gap-3 text-xs">
        <span id={`${name}-error`} className="text-red-700">{errors[name]}</span>
        <span className="shrink-0 text-stone-500">{draft[name].length} / {limit}</span>
      </div>
    </div>;
  }

  const buttonClass = "min-h-12 rounded-xl px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700";

  if (!restored) return <p role="status" className="py-8 text-stone-600">작성 중인 내용을 확인하고 있어요.</p>;
  return <section lang="ko" className="mx-auto max-w-4xl pb-8 text-stone-950" aria-labelledby="builder-title">
    <header>
      <p className="text-sm font-semibold text-amber-700">프로필 빌더</p>
      <h1 id="builder-title" className="mt-2 text-3xl font-semibold tracking-tight">나를 알아가는 세 가지 질문</h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">수업, 동아리, 아르바이트에서 기억에 남는 경험 하나부터 시작해요.</p>
    </header>

    {step === 0 && !review && <ResumeUploader hasExisting={Boolean(draft.experience || draft.keywords || draft.situation || draft.role || draft.action || draft.result)} onApply={values => {
      generation.cancel(); submitted.current = false; setErrors({}); setDraft(previous => ({ ...previous, ...values }));
      notify("분석 결과를 입력폼에 적용했어요. 빈 항목을 보완하고 가치관과 소개 말투는 직접 골라 주세요.");
    }} />}
    <ol aria-label="프로필 입력 단계" className="my-8 grid grid-cols-3 gap-2 border-y border-stone-200 py-4">
      {steps.map((label, index) => <li key={label} aria-current={!review && step === index ? "step" : undefined} className={`text-xs leading-5 ${!review && step === index ? "font-semibold text-amber-900" : "text-stone-500"}`}>
        <span className={`mb-2 grid size-7 place-items-center rounded-full ${index < step || review ? "bg-stone-900 text-white" : step === index ? "bg-amber-200 text-amber-950" : "bg-stone-100"}`} aria-hidden="true">{index < step || review ? "✓" : index + 1}</span>
        {label}
      </li>)}
    </ol>

    <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{review ? "내가 작성한 이야기" : `${step + 1}. ${steps[step]}`}</h2>
    <p className="mt-2 text-xs leading-5 text-stone-500">입력 내용은 이 탭에 임시 저장돼 새로고침 후에도 이어 쓸 수 있어요. 계정 DB에는 아직 저장되지 않으며, 로그아웃하면 임시 저장 내용이 지워져요.</p>
    {storageMessage && <p role="status" className="mt-2 text-sm text-amber-900">{storageMessage}</p>}

    {review ? <div className="mt-6 space-y-6">
      {[
        { title: steps[0], rows: [["경험", draft.experience], ["키워드", draft.keywords]] },
        { title: steps[1], rows: [["상황", draft.situation], ["역할과 목표", draft.role], ["내가 한 행동", draft.action], ["결과와 배운 점", draft.result]] },
        { title: steps[2], rows: [["중요한 가치", draft.values.join(", ")], ["소개 톤", toneOptions[draft.tone as keyof typeof toneOptions]]] },
      ].map((group, index) => <section key={group.title} className="border-b border-stone-200 pb-6" aria-labelledby={`review-${index}`}>
        <div className="flex items-center justify-between"><h3 id={`review-${index}`} className="font-semibold">{group.title}</h3><button type="button" onClick={() => moveTo(index)} className={`${buttonClass} text-amber-900`} aria-label={`${group.title} 수정`}>수정</button></div>
        <dl className="mt-3 space-y-4">{group.rows.map(([label, content]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{content}</dd></div>)}</dl>
      </section>)}
      <section aria-labelledby="generated-profile-title" className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-6">
        <div>
          <h3 id="generated-profile-title" className="font-semibold">AI 프로필 초안</h3>
          {generation.status === "streaming" ? <PendingIndicator message={generation.message || "AI가 초안을 만들고 있어요."} /> :
          <p role="status" aria-live="polite" className="mt-2 text-sm leading-6 text-stone-600">
            {generation.message || "입력 내용을 바탕으로 초안을 만들고 저장할 수 있어요."}
          </p>}
          <p className="mt-2 text-xs leading-5 text-stone-500">초안 생성을 누르면 입력 답변이 OpenAI API로 전송되고, 결과는 내 계정에 저장돼요.</p>
        </div>
        {(generation.status === "streaming" || !generation.saved) && (generation.profile.headline || generation.profile.competency_tags?.length || generation.profile.project_summary || generation.profile.object_guide) && <div className="space-y-4 rounded-xl bg-white p-4">
          {generation.profile.headline && <div><p className="text-xs font-medium text-stone-500">한 줄 소개</p><p className="mt-1 break-words font-semibold">{generation.profile.headline}</p></div>}
          {!!generation.profile.competency_tags?.length && <div><p className="text-xs font-medium text-stone-500">핵심 역량</p><ul className="mt-2 flex flex-wrap gap-2">{generation.profile.competency_tags.map((tag, index) => <li key={`${tag}-${index}`} className="rounded-full border border-stone-200 px-3 py-1 text-sm">{tag}</li>)}</ul></div>}
          {generation.profile.project_summary && <div><p className="text-xs font-medium text-stone-500">프로젝트 요약</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{generation.profile.project_summary}</p></div>}
          {generation.status !== "streaming" && completeGuide.success ? <StarObjectGuideViewer guide={completeGuide.data} /> : generation.profile.object_guide && Object.values(generation.profile.object_guide).some(Boolean) && <div><p className="text-xs font-medium text-stone-500">나의 별 조형 가이드</p><dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {[["주조색", generation.profile.object_guide.primary_color], ["보조색", generation.profile.object_guide.secondary_color], ["배합", generation.profile.object_guide.color_ratio], ["형태 메타포", generation.profile.object_guide.shape_metaphor]].filter((row) => row[1]).map(([label, value]) => <div key={label}><dt className="text-stone-500">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
          </dl></div>}
        </div>}
        {(generation.status === "complete" || generation.status === "fallback") && <p className={`rounded-xl p-3 text-sm leading-6 ${generation.status === "fallback" ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}>
          {generation.status === "fallback" ? "AI 응답을 사용하지 못해 기본 초안으로 저장했어요. 아래에서 내용을 확인하고 직접 수정할 수 있어요." : generation.saved ? "계정에 저장됨 · 아래에서 문구를 확인하고 다듬을 수 있어요." : "저장 여부를 확인하지 못했어요."}
        </p>}
        {generation.status === "error" && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-900">{generation.message}</p>}
        {editing && <p className="text-sm text-amber-900">아래에서 편집 중인 문구를 확인하고 저장한 뒤 새 초안을 만들어 주세요.</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={generation.status === "streaming" || editing} onClick={() => void generation.generate(createWizardPayload(draft, workshopSessionId, currentCard))} className={`${buttonClass} flex-1 bg-stone-900 text-white enabled:hover:bg-stone-700 disabled:opacity-60`}>
            {generation.status === "streaming" ? "초안 만드는 중…" : generation.status === "complete" || generation.status === "fallback" || generation.status === "error" ? "다시 초안 만들기" : "AI 초안 만들기"}
          </button>
          {generation.status === "streaming" && <button type="button" onClick={generation.cancel} className={`${buttonClass} border border-stone-300`}>취소</button>}
        </div>
      </section>
      <button type="button" className={`${buttonClass} w-full border border-stone-300`} onClick={() => moveTo(2)}>입력 내용 계속 수정하기</button>
    </div> : <form onSubmit={submit} noValidate className="mt-7 grid gap-7 md:grid-cols-2">
      {Object.values(errors).some(Boolean) && <div ref={errorSummary} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 outline-none">아래 표시된 항목을 확인한 뒤 다시 진행해 주세요.</div>}
      {step === 0 && <>
        {field("experience", "어떤 경험을 소개하고 싶나요?", "예: 동아리 전시 준비, 카페 아르바이트, 수업 팀 프로젝트", 120, false)}
        {field("keywords", "경험을 떠올리게 하는 키워드", "예: 전시 기획, 일정 조율. 쉼표로 구분해 1~5개 적어 주세요.", 200)}
      </>}
      {step === 1 && <>
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-6 md:col-span-2"><span className="text-stone-500">이야기의 출발점</span><br />{draft.experience}</p>
        {field("situation", "어떤 상황이었나요?", "무엇을 하던 중이었고, 어떤 어려움이 있었는지 적어 주세요.")}
        {field("role", "나의 역할과 목표는 무엇이었나요?", "맡은 일과 이루고 싶었던 목표를 알려 주세요.")}
        {field("action", "문제를 풀기 위해 무엇을 했나요?", "내가 직접 시도한 행동을 20자 이상 적어 주세요.")}
        {field("result", "무엇이 달라졌고, 무엇을 배웠나요?", "숫자 성과가 없어도 괜찮아요. 변화나 배운 점을 10자 이상 적어 주세요.")}
        <button type="button" disabled={cardBusy} className={buttonClass + " border border-stone-300"} onClick={() => void generateCard()}>
          {cardBusy ? "카드 만드는 중…" : currentCard ? "프로젝트 요약 다시 생성" : "프로젝트 요약 생성"}
        </button>
        {cardBusy && <PendingIndicator message="프로젝트 경험을 세 문장으로 정리하고 있어요." />}
        {cardMessage && <p role="status" className="text-sm text-stone-700">{cardMessage}</p>}
        {currentCard && <div className="min-w-0 md:col-span-2">
          <ProjectCardEditor card={currentCard} disabled={cardBusy} onChange={card => setProjectCardDraft({ source: cardSource, card })} />
        </div>}
      </>}
      {step === 2 && <>
        <fieldset aria-describedby={`values-hint${errors.values ? " values-error" : ""}`}>
          <legend className="text-sm font-semibold">나에게 중요한 가치는 무엇인가요? (필수)</legend>
          <p id="values-hint" className="mt-1 text-sm text-stone-500">나를 잘 나타내는 가치를 1~3개 골라 주세요.</p>
          <div className="mt-4 flex flex-wrap gap-3">{values.map(value => <label key={value} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-stone-300 px-4 text-sm has-checked:border-amber-800 has-checked:bg-amber-50 has-focus-visible:outline-2 has-focus-visible:outline-amber-700">
            <input type="checkbox" name="values" value={value} checked={draft.values.includes(value)} disabled={draft.values.length >= 3 && !draft.values.includes(value)} className="size-4 accent-amber-800" onChange={event => {
              setDraft(previous => ({ ...previous, values: event.target.checked ? [...previous.values, value].slice(0, 3) : previous.values.filter(item => item !== value) }));
              setErrors(previous => ({ ...previous, values: undefined }));
            }} />{value}</label>)}</div>
          {errors.values && <p id="values-error" className="mt-2 text-sm text-red-700">{errors.values}</p>}
        </fieldset>
        <fieldset aria-describedby={errors.tone ? "tone-error" : undefined}>
          <legend className="text-sm font-semibold">어떤 말투로 나를 소개할까요? (필수)</legend>
          <div className="mt-4 space-y-3">{Object.entries(toneOptions).map(([tone, label]) => <label key={tone} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-stone-300 px-4 text-sm has-checked:border-amber-800 has-checked:bg-amber-50 has-focus-visible:outline-2 has-focus-visible:outline-amber-700">
            <input type="radio" name="tone" value={tone} checked={draft.tone === tone} className="size-4 accent-amber-800" onChange={() => { setDraft(previous => ({ ...previous, tone })); setErrors(previous => ({ ...previous, tone: undefined })); }} />{label}
          </label>)}</div>
          {errors.tone && <p id="tone-error" className="mt-2 text-sm text-red-700">{errors.tone}</p>}
        </fieldset>
      </>}
      <div className="sticky bottom-14 z-[5] flex gap-3 border-t border-stone-200 bg-white py-4 md:static md:col-span-2">
        {step > 0 && <button type="button" onClick={() => moveTo(step - 1)} className={`${buttonClass} border border-stone-300`}>이전</button>}
        <button type="submit" disabled={cardBusy} className={`${buttonClass} flex-1 bg-stone-900 text-white hover:bg-stone-700`}>{step === 2 ? "입력 내용 확인하기" : "다음 단계"}</button>
      </div>
    </form>}
  </section>;
}
