import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import FollowupInterview from '../src/components/builder/followup-interview';
import ProfileWizard from '../src/components/builder/profile-wizard';
import WorkspaceShell from '../src/components/layouts/workspace-shell';
import FeedbackProvider from '../src/components/layouts/feedback-provider';
function Fixture(){
 const [experience,setExperience]=useState({experience:'카페 안내',situation:'주문을 찾는 손님이 혼란스러웠다.',role:'안내 담당',action:'',result:''});
 return <main className="mx-auto max-w-4xl space-y-6 p-4 text-stone-950"><h1 className="text-2xl font-semibold">맞춤 질문 로컬 검증</h1><label>기존 상황<textarea className="block w-full border p-3" value={experience.situation} onChange={e=>setExperience({...experience,situation:e.target.value})}/></label><FollowupInterview experience={experience} storageKey="orbit.wizard:fixture:followup" onApply={setExperience}/><dl aria-label="반영 결과" className="space-y-3 rounded-xl border border-stone-200 p-4">{Object.entries({experience:"경험 이름",situation:"상황",role:"역할",action:"행동",result:"결과와 배움"}).map(([key,label])=><div key={key}><dt className="text-sm font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-6">{experience[key as keyof typeof experience]||"입력 없음"}</dd></div>)}</dl></main>;
}
createRoot(document.getElementById('root')!).render(window.location.search.includes('wizard')?<WorkspaceShell context={{id:'fixture',name:'테스트',role:'participant',workshop:null,workshopUnavailable:false}}><FeedbackProvider><ProfileWizard/></FeedbackProvider></WorkspaceShell>:<Fixture/>);

