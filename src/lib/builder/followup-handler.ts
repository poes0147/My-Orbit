import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRequestClient } from '@/lib/supabase/request-client';
import { nextSchema, answerSchema, applySchema, sessionSchema, answerSession, type FollowupSession } from './followup-contract';
import { generateFollowupQuestion } from './followup-generator';

const fields='id,base_experience,qa_history,revision,status,expires_at,applied_at,confirmed_experience';
export async function handleFollowup(request:NextRequest, operation:'next'|'answer'|'apply') {
  const {supabase,respond}=createRequestClient(request);
  const json=(body:unknown,status=200)=>respond(NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}}));
  const fail=(message:string,status:number)=>json({success:false,message},status);
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError || !user) return fail('로그인이 필요해요.',401);
  if(request.headers.get('origin')!==request.nextUrl.origin) return fail('요청 출처를 확인할 수 없어요.',403);
  if(!request.headers.get('content-type')?.includes('application/json')) return fail('JSON 요청이 필요해요.',415);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);
  try {
    const reader=request.body?.getReader();
    if(!reader) return fail('요청 내용을 확인해 주세요.',400);
    const chunks:Uint8Array[]=[];let size=0;
    try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000){await reader.cancel();return fail('입력이 너무 길어요.',413);}chunks.push(value);}}
    finally{reader.releaseLock();}
    let raw:unknown;
    try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return fail('요청 내용을 확인해 주세요.',400);}
    const parsed=operation==='next'?nextSchema.safeParse(raw):operation==='answer'?answerSchema.safeParse(raw):applySchema.safeParse(raw);
    if(!parsed.success)return fail('입력 길이와 질문 정보를 확인해 주세요.',400);
    const input=parsed.data;
    const read=()=>supabase.from('ai_followup_sessions').select(fields).eq('id',input.sessionId).eq('user_id',user.id).gt('expires_at',new Date().toISOString()).abortSignal(signal).maybeSingle();
    const loaded=await read();
    if(loaded.error)return fail('문답 저장소를 준비 중이에요. 잠시 후 다시 시도해 주세요.',503);
    let session:FollowupSession|undefined=loaded.data?sessionSchema.parse(loaded.data):undefined;
    let quotaClaimed=false;
    async function claim(){const quota=await supabase.rpc('claim_followup_attempt').abortSignal(signal);if(quota.error)throw new Error('QUOTA_UNAVAILABLE');return quota.data===true;}
    if(!session){
      if(operation!=='next' || !('baseExperience' in input))return fail('문답이 만료됐거나 접근할 수 없어요. 새로 시작해 주세요.',403);
      if(!await claim())return fail('1분에 최대 5번 질문을 생성할 수 있어요. 잠시 후 다시 시도해 주세요.',429);
      quotaClaimed=true;
      const created=await supabase.from('ai_followup_sessions').insert({id:input.sessionId,user_id:user.id,base_experience:input.baseExperience}).select(fields).abortSignal(signal).single();
      if(created.error?.code==='23505'){
        const winner=await read();if(!winner.data)return fail('이 문답에 접근할 수 없어요.',403);session=sessionSchema.parse(winner.data);
      }else if(created.error || !created.data)return fail('문답을 시작하지 못했어요. 다시 시도해 주세요.',503);
      else session=sessionSchema.parse(created.data);
    }
    const current=session;
    const save=async(patch:Record<string,unknown>)=>{
      const updated=await supabase.from('ai_followup_sessions').update({...patch,revision:current.revision+1}).eq('id',current.id).eq('user_id',user.id).eq('revision',current.revision).gt('expires_at',new Date().toISOString()).select(fields).abortSignal(signal).maybeSingle();
      if(updated.error)throw new Error('SAVE_FAILED');
      return updated.data?sessionSchema.parse(updated.data):null;
    };
    if(operation==='next' && 'baseExperience' in input){
      if(JSON.stringify(current.base_experience)!==JSON.stringify(input.baseExperience))return fail('경험 내용이 바뀌었어요. 새 문답을 시작해 주세요.',409);
      if(current.status!=='IN_PROGRESS'||current.qa_history.some(v=>v.answer===null&&!v.is_skipped)||current.qa_history.length>=3)return json({success:true,data:current});
      if(!quotaClaimed&&!await claim())return fail('1분에 최대 5번 질문을 생성할 수 있어요. 잠시 후 다시 시도해 주세요.',429);
      const question=await generateFollowupQuestion(current,signal);
      const saved=await save({qa_history:[...current.qa_history,{...question,answer:null,is_skipped:false}]});
      if(!saved){const winner=await read();return winner.data?json({success:true,data:sessionSchema.parse(winner.data)}):fail('문답이 변경됐어요. 다시 불러와 주세요.',409);}
      return json({success:true,data:saved});
    }
    if(!('revision' in input))return fail('요청 내용을 확인해 주세요.',400);
    if(current.applied_at && operation==='apply' && 'confirmedExperience' in input && JSON.stringify(current.confirmed_experience)===JSON.stringify(input.confirmedExperience))return json({success:true,data:current,experience:current.confirmed_experience});
    if(current.applied_at || current.status==='ABANDONED')return fail('이미 반영했거나 종료된 문답이에요. 새로 시작해 주세요.',409);
    if(current.revision!==input.revision){
      if(operation==='answer'&&'questionIndex' in input){
        const previous=current.qa_history[input.questionIndex];
        if(current.revision===input.revision+1&&current.qa_history.length===input.questionIndex+1&&previous?.is_skipped===input.isSkipped&&previous.answer===(input.isSkipped?null:input.answer?.trim()))return json({success:true,data:current});
      }
      return fail('다른 화면에서 문답이 바뀌었어요. 다시 불러와 주세요.',409);
    }
    let patch:Record<string,unknown>;
    if(operation==='answer'&&'questionIndex' in input){
      if(input.questionIndex>=current.qa_history.length)return fail('아직 생성되지 않은 질문이에요.',400);
      patch=answerSession(current,input.questionIndex,input.answer??'',input.isSkipped);
    }else if(operation==='apply'&&'confirmedExperience' in input){
      if(!current.qa_history.some(v=>v.answer&&!v.is_skipped))return fail('반영할 답변을 먼저 작성해 주세요.',400);
      patch={status:'COMPLETED',applied_at:new Date().toISOString(),confirmed_experience:input.confirmedExperience};
    }else return fail('요청 내용을 확인해 주세요.',400);
    const saved=await save(patch);
    if(!saved)return fail('문답이 변경됐어요. 다시 불러와 주세요.',409);
    return json({success:true,data:saved,...('confirmedExperience' in input?{experience:input.confirmedExperience}:{})});
  }catch(error){
    if(signal.aborted)return fail('질문을 준비하는 시간이 초과됐어요. 다시 시도해 주세요.',504);
    console.warn('Followup request failed',{category:error instanceof z.ZodError?'INVALID_OUTPUT':'UNAVAILABLE'});
    return fail('문답을 처리하지 못했어요. 기존 경험은 유지돼요. 다시 시도해 주세요.',503);
  }
}
