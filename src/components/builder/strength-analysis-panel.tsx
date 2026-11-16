'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { analysisDataSchema, selectedStrengthTagsSchema, type StrengthAnalysis, type StrengthExperience } from '@/lib/strengths/schema';

const button='min-h-11 rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold enabled:cursor-pointer enabled:hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:opacity-50';
export default function StrengthAnalysisPanel({experiences,interviewSessionId,disabled=false,onApply}: {
  experiences?:StrengthExperience[]; interviewSessionId?:string; disabled?:boolean; onApply:(tags:string[])=>void;
}) {
  const source=JSON.stringify(interviewSessionId?{interviewSessionId}:{experiences});
  const sourceRef=useRef(source);
  useEffect(()=>{sourceRef.current=source;},[source]);
  const [result,setResult]=useState<{source:string;data:StrengthAnalysis}|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [custom,setCustom]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const stale=Boolean(result&&result.source!==source);
  const customTags=custom.split(/[,，\n]/).map(item=>item.trim()).filter(Boolean);
  const tags=selectedStrengthTagsSchema.safeParse([...selected,...customTags]);
  const ready=Boolean(interviewSessionId||experiences?.some(item=>item.title.trim()&&item.action.trim().length>=5));
  async function analyze() {
    if(controller.current||disabled) return;
    const request=new AbortController();controller.current=request;
    setBusy(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/builder/analyze-strengths',{method:'POST',headers:{'Content-Type':'application/json'},body:source,signal:request.signal});
      const body=z.object({success:z.boolean(),data:analysisDataSchema.optional(),message:z.string().optional()}).parse(await response.json());
      if(!response.ok||!body.success||!body.data) throw new Error(body.message??'분석 결과를 읽지 못했어요.');
      if(sourceRef.current!==source) {setMessage('분석 중 경험이 바뀌었어요. 다시 분석해 주세요.');return;}
      setResult({source,data:body.data});setSelected(body.data.recommendedStrengths.map(item=>item.name));setCustom('');
    } catch(e) {if(!request.signal.aborted)setError(e instanceof Error?e.message:'분석하지 못했어요. 다시 시도해 주세요.');}
    finally {controller.current=null;setBusy(false);}
  }
  return <section aria-label="경험 기반 강점 분석" className="min-w-0 space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 [overflow-wrap:anywhere]">
    <div><h3 className="font-semibold">내 경험에서 강점 찾기</h3><p className="mt-2 text-sm leading-6 text-stone-600">24개 강점 중 제출한 경험에 근거가 있는 강점을 최대 3개 제안해요. 성격이나 능력을 판정하는 검사는 아니에요.</p></div>
    <p className="text-xs leading-5 text-stone-500">분석을 누르면 경험 내용이 OpenAI API로 전송돼요. 인용 근거는 본인만 볼 수 있고 24시간 뒤 만료돼요. 확인한 태그만 초안에 반영해요.</p>
    <button type="button" className={button} disabled={disabled||busy||!ready} onClick={()=>void analyze()}>{busy?'경험을 분석하는 중…':result?'강점 다시 분석':'내 경험에서 강점 찾기'}</button>
    {!ready&&<p className="text-sm text-stone-600">경험 이름과 내가 직접 한 행동을 먼저 입력해 주세요.</p>}
    {busy&&<p role="status" className="flex items-center gap-2 text-sm"><span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-stone-300 border-t-amber-700 motion-safe:animate-spin"/>행동 근거를 확인하고 있어요.</p>}
    {stale&&<p role="status" className="text-sm text-amber-900">경험 내용이 변경됐어요. 다시 분석해야 반영할 수 있어요.</p>}
    {result&&<div className="space-y-4">
      <p role="status" className="text-sm">근거가 확인된 강점 {result.data.recommendedStrengths.length}개{result.data.isCached?' · 이전 분석 결과':''}</p>
      <fieldset disabled={disabled||busy||stale} className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">초안에 담을 강점을 골라 주세요</legend>
        {result.data.recommendedStrengths.map(item=><div key={item.strengthId} className="min-w-0 rounded-xl border border-stone-200 p-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" className="size-4 accent-amber-800" checked={selected.includes(item.name)} onChange={e=>setSelected(previous=>e.target.checked?[...previous,item.name]:previous.filter(name=>name!==item.name))}/><span className="font-semibold">{item.name}</span><span className="text-xs text-stone-500">{item.clusterName}</span></label>
          <p className="text-sm leading-6">{item.reason}</p>
          <details className="mt-2 text-sm"><summary className="flex min-h-11 cursor-pointer items-center text-amber-800 hover:underline focus-visible:outline-2">행동 근거 보기 · 경험 {item.distinctExperienceCount}개</summary>
            {item.evidences.map((ev,index)=><blockquote key={index} className="mt-2 border-l-2 border-stone-300 pl-3 leading-6"><p>“{ev.quote}”</p><footer className="text-xs text-stone-500">{ev.experienceTitle}</footer></blockquote>)}
          </details>
        </div>)}
        {result.data.followUpQuestions.length>0&&<div className="rounded-xl bg-stone-50 p-3 text-sm leading-6"><p>억지로 세 개를 채우지 않았어요. 경험 입력란을 보완하면 더 살펴볼 수 있어요.</p><ul className="mt-2 list-disc space-y-2 pl-5">{result.data.followUpQuestions.map(question=><li key={question}>{question}</li>)}</ul></div>}
        <label className="block text-sm font-medium">직접 적을 강점 (선택)<input className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-amber-700" value={custom} maxLength={60} onChange={e=>setCustom(e.target.value)} placeholder="쉼표로 구분, 각 2~15자"/></label>
        {customTags.map((tag,index)=><p key={index} className="text-xs text-stone-600">{tag} · 사용자 직접 작성</p>)}
      </fieldset>
      {!tags.success&&<p role="alert" className="text-sm text-red-800">선택·직접 작성한 강점을 합쳐 서로 다른 태그 최대 3개, 각 2~15자로 입력해 주세요.</p>}
      <button type="button" className={button} disabled={disabled||busy||stale||!tags.success} onClick={()=>{if(tags.success){if(result && Date.parse(result.data.expiresAt)<=Date.now()){setError('분석 결과가 만료됐어요. 다시 분석해 주세요.');return;}onApply(tags.data);setMessage('선택한 강점을 초안에 반영했어요. 실제 프로필 반영은 미리보기의 저장 버튼을 눌러 주세요.');}}}>초안에 반영하기</button>
    </div>}
    {error&&<p role="alert" className="text-sm text-red-800">{error} 위 분석 버튼으로 다시 시도할 수 있어요.</p>}
    {message&&<p role="status" className="text-sm text-stone-600">{message}</p>}
  </section>;
}
