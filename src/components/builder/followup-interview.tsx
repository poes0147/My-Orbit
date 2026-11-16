'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { experienceSchema, sessionSchema, proposeExperience, type FollowupExperience, type FollowupSession } from '@/lib/builder/followup-contract';

const button='min-h-11 rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold enabled:cursor-pointer enabled:hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:opacity-50';
const input='mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-amber-700';
const labels={experience:'경험 이름',situation:'상황',role:'나의 역할',action:'직접 한 행동',result:'결과와 배운 점'};
const dimensions={ROLE:'역할 구체화',ACTION:'구체적 행동',RESULT:'결과와 배움',RECALL:'경험 떠올리기'};
const responseSchema=z.object({success:z.boolean(),data:sessionSchema.optional(),experience:experienceSchema.optional(),message:z.string().optional()});

export default function FollowupInterview({experience,storageKey,disabled=false,onApply}:{experience:FollowupExperience;storageKey:string;disabled?:boolean;onApply:(experience:FollowupExperience)=>void}){
  const source=JSON.stringify(experienceSchema.parse(experience));
  const sourceRef=useRef(source);
  useEffect(()=>{sourceRef.current=source;},[source]);
  const [session,setSession]=useState<FollowupSession|null>(null);
  const [answer,setAnswer]=useState('');
  const [editIndex,setEditIndex]=useState<number|null>(null);
  const [proposal,setProposal]=useState<FollowupExperience|null>(null);
  const [busy,setBusy]=useState(false);
  const [slow,setSlow]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [storageWarning,setStorageWarning]=useState('');
  const sessionId=useRef<string|null>(null);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const stale=Boolean(session&&JSON.stringify(session.base_experience)!==source);
  const pending=session?.qa_history.findIndex(t=>t.answer===null&&!t.is_skipped)??-1;
  const index=editIndex??pending;
  const question=index>=0?session?.qa_history[index]:undefined;
  const unsavedAnswer=Boolean(question && answer.trim()!==(question.answer??'').trim());
  const locked=disabled||busy||stale;
  const hasAnswers=session?.qa_history.some(t=>t.answer&&!t.is_skipped)??false;
  const remember=(id:string|null)=>{try{if(id)sessionStorage.setItem(storageKey,JSON.stringify({id,source}));else sessionStorage.removeItem(storageKey);}catch{setStorageWarning('이 브라우저에서는 문답 이어하기를 기억할 수 없어요. 화면을 나가기 전에 경험에 반영해 주세요.');}};
  async function request(operation:string,body:unknown,signal:AbortSignal){
    const response=await fetch(`/api/builder/followup-questions/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
    const data=responseSchema.parse(await response.json());
    if(!response.ok||!data.success||!data.data)throw new Error(data.message??'문답을 불러오지 못했어요.');
    return data;
  }
  async function run(action:(signal:AbortSignal)=>Promise<void>){
    if(controller.current||disabled)return;
    const c=new AbortController();controller.current=c;setBusy(true);setError('');setMessage('');
    const timer=setTimeout(()=>setSlow(true),5000);
    try{await action(c.signal);}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'처리하지 못했어요. 다시 시도해 주세요.');}
    finally{clearTimeout(timer);controller.current=null;setBusy(false);setSlow(false);}
  }
  async function next(signal:AbortSignal,id:string){
    const result=await request('next',{sessionId:id,baseExperience:JSON.parse(source)},signal);
    if(sourceRef.current!==source){setMessage('입력 중 경험이 바뀌었어요. 새 문답을 시작해 주세요.');return;}
    setSession(result.data!);setEditIndex(null);setAnswer('');
    if(result.data!.applied_at && result.data!.confirmed_experience){setProposal(result.data!.confirmed_experience);}
    else if(result.data!.status==='COMPLETED')setProposal(proposeExperience(result.data!));
  }
  function start(fresh=false){void run(async signal=>{
    if(fresh){sessionId.current=null;setSession(null);setProposal(null);setEditIndex(null);setAnswer('');remember(null);}
    if(!sessionId.current){
      if(!fresh)try{const saved=z.object({id:z.uuid(),source:z.string()}).safeParse(JSON.parse(sessionStorage.getItem(storageKey)??'null'));if(saved.success&&saved.data.source===source)sessionId.current=saved.data.id;}catch{setStorageWarning('이전 문답 정보를 읽지 못해 새로 시작해요.');}
      sessionId.current??=crypto.randomUUID();remember(sessionId.current);
    }
    await next(signal,sessionId.current);
  });}
  function submit(skipped:boolean){if(!session||index<0)return;void run(async signal=>{
    const result=await request('answer',{sessionId:session.id,revision:session.revision,questionIndex:index,answer,isSkipped:skipped},signal);
    if(sourceRef.current!==source)return;
    setSession(result.data!);setEditIndex(null);setAnswer('');setProposal(null);
    if(result.data!.status==='COMPLETED')setProposal(proposeExperience(result.data!));
    else await next(signal,session.id);
  });}
  function apply(){if(!session||!proposal||stale)return;void run(async signal=>{
    const result=await request('apply',{sessionId:session.id,revision:session.revision,confirmedExperience:proposal},signal);
    if(sourceRef.current!==source){setMessage('경험 입력이 바뀌어 반영하지 않았어요. 새 문답을 시작해 주세요.');return;}
    if(!result.experience)throw new Error('반영할 내용을 확인하지 못했어요. 다시 시도해 주세요.');
    remember(null);sessionId.current=null;setSession(null);setProposal(null);onApply(result.experience);
    setMessage('확인한 답변을 경험 입력에 반영했어요. 강점을 다시 분석하거나 다음 단계에서 초안을 만들어 주세요.');
  });}
  const validProposal=proposal?experienceSchema.safeParse(proposal).success:false;
  return <section aria-label="AI 맞춤 후속 질문" className="min-w-0 space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 [overflow-wrap:anywhere]">
    <h3 className="font-semibold">경험을 더 구체적으로 이야기해 볼까요?</h3>
    <p className="text-sm leading-6 text-stone-600">AI가 내 경험과 답변을 보고 한 번에 하나씩, 최대 3개 질문을 해요. 건너뛰어도 괜찮아요. 숫자로 된 성과가 없어도 변화나 배운 점을 알려 주세요.</p>
    <p className="text-xs leading-5 text-stone-500">시작하면 경험과 답변이 OpenAI API로 전송돼요. 문답은 본인만 볼 수 있고 24시간 뒤 만료돼요. 확인하기 전에는 기존 경험과 프로필이 바뀌지 않아요.</p>
    {!session&&<button type="button" className={button} disabled={disabled||busy} onClick={()=>start()}>{Object.values(experience).some(v=>v.trim())?'AI 맞춤 질문 시작·이어하기':'경험 회상 질문 시작'}</button>}
    {busy&&<p role="status" className="flex items-center gap-2 text-sm"><span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-stone-300 border-t-amber-700 motion-safe:animate-spin"/>{slow?'질문을 준비하는 데 시간이 걸리고 있어요. 잠시만 기다려 주세요.':'문답을 준비하고 있어요…'}</p>}
    {stale&&<p role="status" className="text-sm text-amber-900">경험 입력이 바뀌었어요. 이전 답변은 덮어쓰지 않고 새 문답을 시작해 주세요.</p>}
    {session&&!proposal&&question&&<div className="space-y-3 rounded-xl bg-stone-50 p-3">
      <p className="text-xs text-stone-600">{index+1} / 3 · {dimensions[question.dimension]}</p>
      <label className="block font-medium">{question.questionText}<textarea className={input} value={answer} maxLength={500} rows={4} disabled={locked} onChange={e=>setAnswer(e.target.value)}/></label>
      <p className="text-xs leading-5 text-stone-600">{question.contextHint} · {answer.length}/500자</p>
      {editIndex!==null&&<p className="text-sm text-amber-900">수정하면 이 질문 뒤의 문답은 삭제하고 새 답변에 맞춰 다시 질문해요.</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={locked||answer.replace(/\s/g,'').length<5} onClick={()=>submit(false)}>답변 완료</button><button type="button" className={button} disabled={locked} onClick={()=>submit(true)}>이 질문 건너뛰기</button></div>
    </div>}
    {session&&!proposal&&<div className="flex flex-wrap gap-2">
      {pending<0&&session.status==='IN_PROGRESS'&&<button type="button" className={button} disabled={locked} onClick={()=>start()}>다음 질문 불러오기</button>}
      {!session.applied_at&&session.qa_history.map((turn,i)=>(turn.answer!==null||turn.is_skipped)&&<button key={i} type="button" className={button} disabled={locked||unsavedAnswer} onClick={()=>{setEditIndex(i);setAnswer(turn.answer??'');}}>{i+1}번 답변 수정</button>)}
      <button type="button" className={button} disabled={locked||!hasAnswers||unsavedAnswer} onClick={()=>setProposal(proposeExperience(session))}>여기까지 검토하기</button>
      {unsavedAnswer&&<p className="w-full text-sm text-stone-600">작성 중인 답변은 ‘답변 완료’를 눌러 저장한 뒤 검토할 수 있어요.</p>}
    </div>}
    {proposal&&session&&<div className="space-y-4">
      <h4 className="font-semibold">경험에 반영하기 전에 확인해 주세요</h4>
      <p className="text-sm leading-6">답변 원문을 해당 항목에 덧붙였어요. 필요한 부분만 남기고 수정할 수 있어요.</p>
      {(Object.keys(labels) as (keyof FollowupExperience)[]).map(key=><div key={key} className="space-y-2">
        <p className="text-xs leading-5 text-stone-600">기존 {labels[key]}: {session.base_experience[key]||'입력 없음'}</p>
        <label className="block text-sm font-medium">반영할 {labels[key]}<textarea rows={key==='experience'?2:4} className={input} value={proposal[key]} disabled={locked} onChange={e=>setProposal({...proposal,[key]:e.target.value})}/></label>
        <p className="text-xs text-stone-600">{proposal[key].length}/{key==='experience'?120:500}자</p>
      </div>)}
      {!validProposal&&<p role="alert" className="text-sm text-red-800">내용을 자동으로 자르지 않았어요. 경험 이름은 120자, 나머지는 각 500자 이내로 정리해 주세요.</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={locked||!validProposal||!hasAnswers} onClick={apply}>경험에 반영하기</button><button type="button" className={button} disabled={busy} onClick={()=>{setProposal(null);setMessage('기존 경험은 변경하지 않았어요.');}}>취소하고 돌아가기</button>
        {!session.applied_at&&session.qa_history.map((turn,i)=>(turn.answer!==null||turn.is_skipped)&&<button key={i} type="button" className={button} disabled={locked} onClick={()=>{setProposal(null);setEditIndex(i);setAnswer(turn.answer??'');}}>{i+1}번 답변 수정</button>)}
      </div>
    </div>}
    {(session||error)&&<button type="button" className={button} disabled={disabled||busy} onClick={()=>start(true)}>새 문답 시작</button>}
    {error&&<div role="alert" className="space-y-2 text-sm text-red-800"><p>{error}</p><button type="button" className={button} disabled={busy||disabled||stale} onClick={()=>start()}>문답 다시 불러오기</button></div>}
    {storageWarning&&<p role="status" className="text-sm text-amber-900">{storageWarning}</p>}
    {message&&<p role="status" className="text-sm text-stone-600">{message}</p>}
  </section>;
}
