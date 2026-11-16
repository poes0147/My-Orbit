import { z } from 'zod';

export const experienceSchema = z.object({
  experience: z.string().max(120), situation: z.string().max(500),
  role: z.string().max(500), action: z.string().max(500), result: z.string().max(500),
}).strict();
export type FollowupExperience = z.infer<typeof experienceSchema>;
export const questionSchema = z.object({
  dimension: z.enum(['ROLE', 'ACTION', 'RESULT', 'RECALL']),
  questionText: z.string().trim().min(5).max(100),
  contextHint: z.string().trim().max(120),
}).strict();
export const turnSchema = questionSchema.extend({ answer: z.string().max(500).nullable(), is_skipped: z.boolean() });
export const sessionSchema = z.object({
  id: z.uuid(), base_experience: experienceSchema, qa_history: z.array(turnSchema).max(3),
  revision: z.number().int().nonnegative(), status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED']),
  expires_at: z.string(), applied_at: z.string().nullable(), confirmed_experience:experienceSchema.nullable(),
});
export type FollowupSession = z.infer<typeof sessionSchema>;
export const nextSchema = z.object({sessionId: z.uuid(), baseExperience: experienceSchema}).strict();
export const answerSchema = z.object({
  sessionId:z.uuid(), revision:z.number().int().nonnegative(), questionIndex:z.number().int().min(0).max(2),
  answer:z.string().max(500).optional(), isSkipped:z.boolean(),
}).strict().refine(v=>v.isSkipped || (v.answer??'').replace(/\s/g,'').length>=5);
export const applySchema = z.object({sessionId:z.uuid(), revision:z.number().int().nonnegative(), confirmedExperience:experienceSchema}).strict();
type SessionContent = Pick<FollowupSession,'base_experience'|'qa_history'|'revision'|'status'>;
export function answerSession(session:SessionContent, index:number, answer:string, skipped:boolean) {
  if(index<0 || index>=session.qa_history.length || session.status==='ABANDONED') throw new Error('INVALID_INDEX');
  const history=session.qa_history.slice(0,index+1);
  history[index]={...history[index],answer:skipped?null:answer.trim(),is_skipped:skipped};
  return {qa_history:history, status:history.length===3?'COMPLETED' as const:'IN_PROGRESS' as const};
}
export function proposeExperience(session:Pick<SessionContent,'base_experience'|'qa_history'>):FollowupExperience {
  const proposal={...session.base_experience};
  const fields={ROLE:'role',ACTION:'action',RESULT:'result',RECALL:'situation'} as const;
  for(const turn of session.qa_history) {
    if(turn.is_skipped || !turn.answer?.trim()) continue;
    const field=fields[turn.dimension];
    if(proposal[field].includes(turn.answer.trim())) continue;
    proposal[field]=[proposal[field].trim(),turn.answer.trim()].filter(Boolean).join('\n');
  }
  return proposal;
}
