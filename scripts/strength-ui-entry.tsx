import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import StrengthAnalysisPanel from '../src/components/builder/strength-analysis-panel';
import SavedDraftEditor from '../src/components/builder/saved-draft-editor';
import ProfileWizard from '../src/components/builder/profile-wizard';
import WorkspaceShell from '../src/components/layouts/workspace-shell';
import FeedbackProvider from '../src/components/layouts/feedback-provider';
function Fixture(){
 const [action,setAction]=useState('컵 번호가 잘 보이지 않는 것을 관찰하고 컵 방향을 바꿨다.');
 const [tags,setTags]=useState<string[]>([]);
 return <main lang="ko" className="mx-auto max-w-4xl space-y-6 p-4 text-stone-950">
  <h1 className="text-2xl font-semibold">강점 분석 로컬 검증</h1>
  <label className="block">경험 행동<textarea aria-label="경험 행동" className="block w-full border p-3" value={action} onChange={e=>setAction(e.target.value)}/></label>
  <StrengthAnalysisPanel experiences={[{id:'experience',title:'카페 운영',role:'담당자',problem:'혼잡',action,outcome:'동선 개선'}]} onApply={setTags}/>
  <p aria-label="선택 결과">선택 결과: {tags.join(', ') || '없음'}</p>
  <SavedDraftEditor workshopSessionId={null} revision={0} locked={false}/>
 </main>;
}
createRoot(document.getElementById('root')!).render(window.location.search.includes('wizard')?
 <WorkspaceShell context={{id:'fixture',name:'테스트',role:'participant',workshop:null,workshopUnavailable:false}}><FeedbackProvider><ProfileWizard/></FeedbackProvider></WorkspaceShell>:<Fixture/>);
