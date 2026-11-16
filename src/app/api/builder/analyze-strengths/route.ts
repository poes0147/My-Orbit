import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRequestClient } from '@/lib/supabase/request-client';
import { getProfileAiConfig } from '@/lib/builder/openai-config';
import { analyzeStrengths, strengthInputHash } from '@/lib/strengths/analyzer';
import { strengthInputSchema, analysisDataSchema } from '@/lib/strengths/schema';

export const maxDuration = 30;
const requestSchema = z.union([strengthInputSchema, z.object({ interviewSessionId: z.uuid() }).strict()]);

export async function POST(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status=200) => respond(NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }));
  const fail = (message: string, status: number) => json({ success:false, message },status);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail('로그인이 필요해요.',401);
  if (request.headers.get('origin') !== request.nextUrl.origin) return fail('요청 출처를 확인할 수 없어요.',403);
  if (!request.headers.get('content-type')?.includes('application/json')) return fail('JSON 요청이 필요해요.',415);
  if (Number(request.headers.get('content-length') ?? 0)>32000) return fail('입력이 너무 길어요.',413);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);
  try {
    const reader=request.body?.getReader();
    if(!reader) return fail('요청 내용을 확인해 주세요.',400);
    const chunks:Uint8Array[]=[];let size=0;
    try {
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
        if(size>32000){await reader.cancel();return fail('입력이 너무 길어요.',413);}chunks.push(value);}
    } finally {reader.releaseLock();}
    const raw=Buffer.concat(chunks).toString('utf8');
    const parsed=requestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fail('경험 이름과 구체적인 행동을 먼저 입력해 주세요.',400);
    let input;
    if ('interviewSessionId' in parsed.data) {
      const {data,error}=await supabase.from('ai_interview_sessions').select('answers').eq('id',parsed.data.interviewSessionId).eq('user_id',user.id).eq('status','completed').maybeSingle();
      if(error) return fail('초안을 불러오지 못했어요.',503);
      if(!data) return fail('이 초안에 접근할 수 없어요.',403);
      const project=data.answers?.step_responses?.project;
      input=strengthInputSchema.safeParse({experiences:[{...project,id:'experience'}]});
    } else input=strengthInputSchema.safeParse(parsed.data);
    if(!input.success) return fail('경험 내용을 보완한 뒤 다시 시도해 주세요.',400);
    const {model}=getProfileAiConfig();
    const inputHash=strengthInputHash(input.data.experiences,model);
    const readCache=()=>supabase.from('strength_analyses').select('id,input_hash,expires_at,analyzed_strengths,follow_up_questions')
      .eq('user_id',user.id).eq('input_hash',inputHash).gt('expires_at',new Date().toISOString()).abortSignal(signal).maybeSingle();
    const toResult=(row: {id:string; input_hash:string; expires_at:string; analyzed_strengths:unknown; follow_up_questions:unknown}, isCached:boolean)=>analysisDataSchema.parse({
      analysisId:row.id,inputHash:row.input_hash,expiresAt:row.expires_at,isCached,recommendedStrengths:row.analyzed_strengths,followUpQuestions:row.follow_up_questions,
    });
    const cached=await readCache();
    if(cached.error) return fail('강점 분석 저장소를 준비 중이에요. 잠시 후 다시 시도해 주세요.',503);
    if(cached.data) return json({success:true,data:toResult(cached.data,true)});
    const quota=await supabase.rpc('claim_strength_analysis_attempt').abortSignal(signal);
    if(quota.error) return fail('분석을 시작하지 못했어요. 다시 시도해 주세요.',503);
    if(!quota.data) return fail('1분에 최대 5번 분석할 수 있어요. 잠시 후 다시 시도해 주세요.',429);
    const result=await analyzeStrengths(input.data.experiences,signal);
    const saved=await supabase.from('strength_analyses').insert({user_id:user.id,input_hash:inputHash,model_name:model,analyzed_strengths:result.recommendedStrengths,follow_up_questions:result.followUpQuestions})
      .select('id,input_hash,expires_at,analyzed_strengths,follow_up_questions').abortSignal(signal).single();
    if(saved.error?.code==='23505') {
      const winner=await readCache();
      if(winner.data) return json({success:true,data:toResult(winner.data,true)});
    }
    if(saved.error||!saved.data) return fail('분석 결과를 보관하지 못했어요. 기존 초안은 유지돼요.',503);
    return json({success:true,data:toResult(saved.data,false)});
  } catch(error) {
    if(signal.aborted) return fail('분석 시간이 초과됐어요. 다시 시도해 주세요.',504);
    if(error instanceof SyntaxError) return fail('요청 내용을 확인해 주세요.',400);
    console.warn('Strength analysis failed',{category:error instanceof z.ZodError?'INVALID_OUTPUT':'UNAVAILABLE'});
    return fail('강점 분석을 완료하지 못했어요. 기존 내용은 유지됩니다. 다시 시도해 주세요.',503);
  }
}
