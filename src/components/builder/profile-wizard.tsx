"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useProfileStream } from "@/lib/builder/use-profile-stream";
import { createWizardPayload, initialDraft, toneOptions, validateDraft, valueOptions, type Draft, type DraftErrors, type WizardPayload } from "@/lib/builder/draft";

const steps = ["경험 키워드", "역할과 성과", "가치관과 소개 톤"];
const values = valueOptions;
type Tone = keyof typeof toneOptions;
type Field = Exclude<keyof Draft, "values" | "tone">;
type Errors = DraftErrors;

export default function ProfileWizard({ onSubmitDraft }: { onSubmitDraft?: (payload: WizardPayload) => void } = {}) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const generation = useProfileStream();
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
  }, [step, review]);

  function moveTo(next: number) {
    generation.cancel();
    setErrors({});
    setReview(false);
    setStep(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDraft(draft, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    if (step < 2) moveTo(step + 1);
    else {
      for (let index = 0; index < 3; index++) {
        const allErrors = validateDraft(draft, index);
        if (Object.keys(allErrors).length) { moveTo(index); setErrors(allErrors); return; }
      }
      onSubmitDraft?.(createWizardPayload(draft, null));
      setReview(true);
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

  return <section lang="ko" className="pb-8 text-stone-950" aria-labelledby="builder-title">
    <header>
      <p className="text-sm font-semibold text-amber-700">프로필 빌더</p>
      <h1 id="builder-title" className="mt-2 text-3xl font-semibold tracking-tight">나를 알아가는 세 가지 질문</h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">수업, 동아리, 아르바이트에서 기억에 남는 경험 하나부터 시작해요.</p>
    </header>

    <ol aria-label="프로필 입력 단계" className="my-8 grid grid-cols-3 gap-2 border-y border-stone-200 py-4">
      {steps.map((label, index) => <li key={label} aria-current={!review && step === index ? "step" : undefined} className={`text-xs leading-5 ${!review && step === index ? "font-semibold text-amber-900" : "text-stone-500"}`}>
        <span className={`mb-2 grid size-7 place-items-center rounded-full ${index < step || review ? "bg-stone-900 text-white" : step === index ? "bg-amber-200 text-amber-950" : "bg-stone-100"}`} aria-hidden="true">{index < step || review ? "✓" : index + 1}</span>
        {label}
      </li>)}
    </ol>

    <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{review ? "내가 작성한 이야기" : `${step + 1}. ${steps[step]}`}</h2>
    <p className="mt-2 text-xs leading-5 text-stone-500">입력 내용은 이 화면을 열어 둔 동안만 유지돼요. 새로고침하거나 화면을 나가면 사라지며, 아직 계정에 저장되지 않아요.</p>

    {review ? <div className="mt-6 space-y-6">
      {[
        { title: steps[0], rows: [["경험", draft.experience], ["키워드", draft.keywords]] },
        { title: steps[1], rows: [["상황", draft.situation], ["역할과 목표", draft.role], ["내가 한 행동", draft.action], ["결과와 배운 점", draft.result]] },
        { title: steps[2], rows: [["중요한 가치", draft.values.join(", ")], ["소개 톤", toneOptions[draft.tone as Tone]]] },
      ].map((group, index) => <section key={group.title} className="border-b border-stone-200 pb-6" aria-labelledby={`review-${index}`}>
        <div className="flex items-center justify-between"><h3 id={`review-${index}`} className="font-semibold">{group.title}</h3><button type="button" onClick={() => moveTo(index)} className={`${buttonClass} text-amber-900`} aria-label={`${group.title} 수정`}>수정</button></div>
        <dl className="mt-3 space-y-4">{group.rows.map(([label, content]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{content}</dd></div>)}</dl>
      </section>)}
      <section aria-labelledby="generated-profile-title" className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-6">
        <div>
          <h3 id="generated-profile-title" className="font-semibold">AI 프로필 초안</h3>
          <p role="status" aria-live="polite" className="mt-2 text-sm leading-6 text-stone-600">{generation.message || "입력 내용을 바탕으로 초안을 만들고 저장할 수 있어요."}</p>
          <p className="mt-2 text-xs leading-5 text-stone-500">초안 생성을 누르면 입력 답변이 OpenAI API로 전송되고, 결과는 내 계정에 저장돼요.</p>
        </div>
        {(generation.profile.headline || generation.profile.competency_tags?.length || generation.profile.project_summary || generation.profile.object_guide) && <div className="space-y-4 rounded-xl bg-white p-4">
          {generation.profile.headline && <div><p className="text-xs font-medium text-stone-500">한 줄 소개</p><p className="mt-1 break-words font-semibold">{generation.profile.headline}</p></div>}
          {!!generation.profile.competency_tags?.length && <div><p className="text-xs font-medium text-stone-500">핵심 역량</p><ul className="mt-2 flex flex-wrap gap-2">{generation.profile.competency_tags.map((tag, index) => <li key={`${tag}-${index}`} className="rounded-full border border-stone-200 px-3 py-1 text-sm">{tag}</li>)}</ul></div>}
          {generation.profile.project_summary && <div><p className="text-xs font-medium text-stone-500">프로젝트 요약</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{generation.profile.project_summary}</p></div>}
          {generation.profile.object_guide && Object.values(generation.profile.object_guide).some(Boolean) && <div><p className="text-xs font-medium text-stone-500">나의 별 조형 가이드</p><dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {[ ["주조색", generation.profile.object_guide.primary_color], ["보조색", generation.profile.object_guide.secondary_color], ["배합", generation.profile.object_guide.color_ratio], ["형태 메타포", generation.profile.object_guide.shape_metaphor] ].filter((row) => row[1]).map(([label, value]) => <div key={label}><dt className="text-stone-500">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
          </dl></div>}
        </div>}
        {(generation.status === "complete" || generation.status === "fallback") && <p className={`rounded-xl p-3 text-sm leading-6 ${generation.status === "fallback" ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}>
          {generation.status === "fallback" ? "AI 연결이 없거나 응답이 지연되어 기본 초안으로 저장했어요. AI 생성은 OPENAI_API_KEY 설정 후 사용할 수 있어요." : generation.saved ? "계정에 저장됨" : "저장 여부를 확인하지 못했어요."}
        </p>}
        {generation.status === "error" && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-900">{generation.message}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={generation.status === "streaming"} onClick={() => void generation.generate(createWizardPayload(draft, null))} className={`${buttonClass} flex-1 bg-stone-900 text-white hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60`}>
            {generation.status === "streaming" ? "초안 만드는 중…" : generation.status === "complete" || generation.status === "fallback" || generation.status === "error" ? "다시 초안 만들기" : "AI 초안 만들기"}
          </button>
          {generation.status === "streaming" && <button type="button" onClick={generation.cancel} className={`${buttonClass} border border-stone-300`}>취소</button>}
        </div>
      </section>
      <button type="button" className={`${buttonClass} w-full border border-stone-300`} onClick={() => moveTo(2)}>입력 내용 계속 수정하기</button>
    </div> : <form onSubmit={submit} noValidate className="mt-7 space-y-7">
      {Object.values(errors).some(Boolean) && <div ref={errorSummary} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 outline-none">아래 표시된 항목을 확인한 뒤 다시 진행해 주세요.</div>}
      {step === 0 && <>
        {field("experience", "어떤 경험을 소개하고 싶나요?", "예: 동아리 전시 준비, 카페 아르바이트, 수업 팀 프로젝트", 120, false)}
        {field("keywords", "경험을 떠올리게 하는 키워드", "예: 전시 기획, 일정 조율, 손님 응대. 떠오르는 말을 편하게 적어 주세요.", 200)}
      </>}
      {step === 1 && <>
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-6"><span className="text-stone-500">이야기의 출발점</span><br />{draft.experience}</p>
        {field("situation", "어떤 상황이었나요?", "무엇을 하던 중이었고, 어떤 어려움이 있었는지 적어 주세요.")}
        {field("role", "나의 역할과 목표는 무엇이었나요?", "맡은 일과 이루고 싶었던 목표를 알려 주세요.")}
        {field("action", "문제를 풀기 위해 무엇을 했나요?", "내가 직접 시도한 행동을 20자 이상 적어 주세요.")}
        {field("result", "무엇이 달라졌고, 무엇을 배웠나요?", "숫자 성과가 없어도 괜찮아요. 변화나 배운 점을 10자 이상 적어 주세요.")}
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
      <div className="flex gap-3 border-t border-stone-200 pt-5">
        {step > 0 && <button type="button" onClick={() => moveTo(step - 1)} className={`${buttonClass} border border-stone-300`}>이전</button>}
        <button type="submit" className={`${buttonClass} flex-1 bg-stone-900 text-white hover:bg-stone-700`}>{step === 2 ? "입력 내용 확인하기" : "다음 단계"}</button>
      </div>
    </form>}
  </section>;
}
