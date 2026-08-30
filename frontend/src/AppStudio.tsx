import { useEffect, useMemo, useState } from 'react'
import './AppStudio.css'

type Lesson = { id:string; order:number; level?:number; unit?:string; title:string; concept:string; why:string; example:string; exampleOutput:string; prompt:string; starterCode:string; expectedOutput:string; hints:string[]; solution?:string; solutionExplanation?:string; summary:string; estimatedMinutes:number }
type Mistake = { lessonId:string; title:string; unit:string; code:string; output:string; expectedOutput:string; hintLevel:number; nextReview:string }
type TodayItem = Lesson & { itemType:'review'|'new'; completedToday:boolean }
type Today = { items:TodayItem[]; estimatedMinutes:number; reviewCount:number; newCount:number }
type Result = { correct:boolean; output:string; feedback:string; executionError?:boolean; completedIds?:string[]; dueLessons?:Lesson[]; mistakes?:Mistake[]; todaySession?:Today }
type RunResult = { success:boolean; output:string; error:string }
type SolutionViewResponse = { success:boolean; message:string; nextReview?:string; dueLessons?:Lesson[]; mistakes?:Mistake[]; todaySession?:Today }
type Page = 'today'|'studio'|'mistakes'|'kaggle'

// Local Vite uses its proxy. In Vercel, VITE_API_URL points at the Render API origin.
const API=(import.meta.env.VITE_API_URL??'/api').replace(/\/$/,'')
const fallback:Lesson[]=[{id:'hello-print',order:1,level:1,unit:'출력',title:'화면에 글자 보여주기',concept:'print()는 컴퓨터에게 내용을 화면에 보여 달라고 하는 명령입니다.',why:'코드를 실행한 결과를 확인하는 가장 첫 도구예요.',example:'print("안녕하세요")',exampleOutput:'안녕하세요',prompt:'화면에 “안녕하세요”를 출력해 보세요.',starterCode:'# 여기에 코드를 작성해 보세요\n',expectedOutput:'안녕하세요',hints:['화면에 내용을 보여줄 때 쓰는 함수를 떠올려 보세요.','글자는 따옴표로 감쌉니다.','print(________)'],summary:'print()는 값을 화면에 출력합니다.',estimatedMinutes:7}]
const levelOf=(lesson:Lesson)=>lesson.level??(lesson.order<=15?1:lesson.order<=21?2:lesson.order<=27?3:lesson.order<=33?4:5)
const levelName=(level:number)=>['','파이썬 첫걸음','조건문으로 판단하기','반복으로 데이터 다루기','자료구조로 데이터 묶기','함수로 분석 로직 만들기'][level]??`레벨 ${level}`

export default function AppStudio(){
  const [page,setPage]=useState<Page>('today')
  const [lessons,setLessons]=useState<Lesson[]>(fallback)
  const [selected,setSelected]=useState('hello-print')
  const [code,setCode]=useState(fallback[0].starterCode)
  const [hint,setHint]=useState(0)
  const [done,setDone]=useState<string[]>(()=>JSON.parse(localStorage.getItem('pycoach-completed')??'[]'))
  const [today,setToday]=useState<Today|null>(null)
  const [reviews,setReviews]=useState<Lesson[]>([])
  const [mistakes,setMistakes]=useState<Mistake[]>([])
  const [runResult,setRunResult]=useState<RunResult|null>(null)
  const [result,setResult]=useState<Result|null>(null)
  const [loading,setLoading]=useState(false)
  const [labAnswer,setLabAnswer]=useState<string|null>(null)
  const [solutionOpen,setSolutionOpen]=useState(false)
  const [solutionNotice,setSolutionNotice]=useState('')

  useEffect(()=>{
    async function loadDashboard(){
      try{
        const [lessonResponse,progressResponse,reviewResponse,mistakeResponse,todayResponse]=await Promise.all([fetch(`${API}/lessons`),fetch(`${API}/progress`),fetch(`${API}/reviews/due`),fetch(`${API}/mistakes`),fetch(`${API}/today`)])
        if(lessonResponse.ok)setLessons(await lessonResponse.json())
        if(progressResponse.ok){const data=await progressResponse.json();setDone(data.completedIds);localStorage.setItem('pycoach-completed',JSON.stringify(data.completedIds))}
        if(reviewResponse.ok)setReviews((await reviewResponse.json()).lessons)
        if(mistakeResponse.ok)setMistakes((await mistakeResponse.json()).mistakes)
        if(todayResponse.ok)setToday(await todayResponse.json())
      }catch{/* The fallback keeps the first lesson visible while the API starts. */}
    }
    void loadDashboard()
  },[])

  const lesson=lessons.find(item=>item.id===selected)??lessons[0]
  const levels=useMemo(()=>Array.from({length:5},(_,index)=>lessons.filter(item=>levelOf(item)===index+1)),[lessons])
  const progress=Math.round(done.length/lessons.length*100)
  const next=today?.items.find(item=>!item.completedToday)
  const reviewItems=today?.items.filter(item=>item.itemType==='review'&&!item.completedToday)??[]

  function go(destination:Page){setPage(destination);window.scrollTo({top:0,behavior:'smooth'})}
  function choose(item:Lesson){setSelected(item.id);setCode(item.starterCode);setHint(0);setResult(null);setRunResult(null);setSolutionOpen(false);setSolutionNotice('');go('studio')}
  function update(data:Partial<Result>&Partial<SolutionViewResponse>){if(data.todaySession)setToday(data.todaySession);if(data.dueLessons)setReviews(data.dueLessons);if(data.mistakes)setMistakes(data.mistakes);if(data.completedIds){setDone(data.completedIds);localStorage.setItem('pycoach-completed',JSON.stringify(data.completedIds))}}

  async function run(){setLoading(true);setResult(null);setRunResult(null);try{const response=await fetch(`${API}/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id,code})});if(!response.ok)throw Error();setRunResult(await response.json())}catch{setRunResult({success:false,output:'',error:'백엔드에 연결할 수 없어요.'})}finally{setLoading(false)}}
  async function check(){setLoading(true);setResult(null);try{const response=await fetch(`${API}/check`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id,code,hintLevel:hint})});if(!response.ok)throw Error();const data:Result=await response.json();setResult(data);update(data)}catch{setResult({correct:false,output:'',feedback:'백엔드에 연결할 수 없어요.'})}finally{setLoading(false)}}
  async function showSolution(){setSolutionOpen(true);if(!lesson.solution)return;try{const response=await fetch(`${API}/solution-viewed`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id})});if(!response.ok)throw Error();const data:SolutionViewResponse=await response.json();setSolutionNotice(data.message);update(data)}catch{setSolutionNotice('해설은 열었어요. 복습 일정은 백엔드 연결 후 다시 저장됩니다.')}}
  const Nav=({id,label,icon}:{id:Page;label:string;icon:string})=><button className={page===id?'active':''} onClick={()=>go(id)}><span>{icon}</span>{label}</button>

  return <div className="studio-shell">
    <aside className="studio-sidebar"><button className="studio-brand" onClick={()=>go('today')}><b>&lt;/&gt;</b><span>PyCoach<small>PYTHON LEARNING LAB</small></span></button><p>학습 메뉴</p><nav><Nav id="today" icon="⌂" label="오늘의 학습"/><Nav id="studio" icon="▦" label="학습 스튜디오"/><Nav id="mistakes" icon="◌" label="오답노트"/><Nav id="kaggle" icon="◇" label="Kaggle 준비"/></nav><div className="side-meter"><small>전체 진도</small><strong>{progress}%</strong><i><em style={{width:`${progress}%`}}/></i><span>{done.length} / {lessons.length} 레슨 완료</span></div></aside>
    <main className="studio-main">
      <header className="studio-header"><div><span>PYCOACH</span><h1>{page==='today'?'오늘의 학습':page==='studio'?'학습 스튜디오':page==='mistakes'?'오답노트':'Kaggle Ready'}</h1><p>{page==='studio'?'왼쪽에서 레슨을 고르고 개념을 확인한 뒤, 오른쪽에서 직접 실행해 보세요.':page==='today'?'오늘 필요한 만큼만 학습하고, 기억이 흐려지기 전에 다시 만나요.':page==='mistakes'?'틀린 문제와 해설을 본 문제는 일정 시간이 지난 뒤 다시 풉니다.':'경진대회 전에 표 데이터의 행, 특징, 타깃을 먼저 읽어 봅니다.'}</p></div><b className="streak">🔥 3일 연속</b></header>
      {page==='today'&&<section>
        <article className="today-banner"><span>오늘의 작은 목표</span><h2>{next?next.itemType==='review'?'복습 문제를 다시 꺼내 볼까요?':`${next.title}을(를) 시작해 볼까요?`:'오늘 계획을 모두 마쳤어요!'}</h2><p>{next?`약 ${today?.estimatedMinutes??next.estimatedMinutes}분이면 충분해요. 이해한 뒤 직접 작성해 보세요.`:'다음 복습이 준비되면 이곳에서 알려 드릴게요.'}</p>{next&&<button onClick={()=>choose(next)}>학습 시작하기 →</button>}</article>
        <div className="today-stats"><article><small>전체 진도</small><strong>{progress}%</strong><span>{done.length}/{lessons.length} 레슨</span></article><article><small>오늘의 복습</small><strong>{today?.reviewCount??reviews.length}</strong><span>기억을 다시 꺼낼 문제</span></article><article><small>오답·해설 복습</small><strong>{mistakes.length}</strong><span>다시 볼 문제</span></article></div>
        <section className="today-plan"><div className="title-row"><div><span>SPACED REVIEW</span><h2>복습 우선순위</h2></div><button onClick={()=>go('mistakes')}>오답노트 열기 →</button></div>{reviewItems.length>0?reviewItems.map(item=><button key={item.id} onClick={()=>choose(item)} className="plan-row"><b>↻</b><span><strong>{item.title}</strong><small>기억을 확인하는 복습 문제</small></span><em>다시 풀기</em></button>):<div className="empty-state" style={{padding:'20px'}}><b>✓</b><p>오늘 예정된 복습은 없어요. 해설을 본 문제는 내일 이곳에 나타납니다.</p></div>}</section>
        <section className="today-plan" style={{marginTop:14}}><div className="title-row"><div><span>TODAY PLAN</span><h2>오늘의 순서</h2></div><button onClick={()=>go('studio')}>학습 스튜디오 열기 →</button></div>{today?.items.map(item=><button key={item.id} onClick={()=>choose(item)} className="plan-row"><b>{item.completedToday?'✓':item.itemType==='review'?'↻':'+'}</b><span><strong>{item.title}</strong><small>{item.itemType==='review'?'복습':'새 레슨'}</small></span><em>{item.completedToday?'완료':'시작'}</em></button>)}</section>
      </section>}
      {page==='studio'&&<section className="learning-studio">
        <aside className="course-panel"><div className="course-panel-head"><span>LEARNING COURSE</span><h2>레벨별 코스</h2><p>제목을 누르면 오른쪽 실습 문제가 바뀝니다.</p></div>{levels.map((items,index)=>items.length>0&&<details key={index} open={levelOf(lesson)===index+1}><summary><span>LEVEL {String(index+1).padStart(2,'0')}</span><strong>{levelName(index+1)}</strong><small>{items.filter(item=>done.includes(item.id)).length}/{items.length}</small></summary>{items.map(item=><button key={item.id} className={item.id===lesson.id?'selected':''} onClick={()=>choose(item)}><b>{done.includes(item.id)?'✓':item.order}</b><span>{item.title}<small>{item.unit}</small></span></button>)}</details>)}</aside>
        <div className="lesson-panel"><div className="selected-head"><span>LEVEL {levelOf(lesson)} · {lesson.unit}</span><h2>{lesson.title}</h2><p>{lesson.summary}</p></div><details className="concept-details"><summary><span>개념 설명</span><b>열기 +</b></summary><div><h3>무엇을 배우나요?</h3><p>{lesson.concept}</p><h3>왜 배울까요?</h3><p>{lesson.why}</p><div className="sample"><span>예시 코드</span><code>{lesson.example}</code><pre>결과{'\n'}{lesson.exampleOutput}</pre></div></div></details>
          <article className="practice-card"><span>CODE PRACTICE</span><h3>{lesson.prompt}</h3><label htmlFor="code">코드 작성</label><textarea id="code" value={code} onChange={event=>{setCode(event.target.value);setResult(null);setRunResult(null)}} spellCheck="false"/><div className="code-meta"><span>Python</span><span>UTF-8</span></div><div className="practice-actions"><button className="run" onClick={()=>void run()} disabled={loading}>{loading?'실행 중...':'▷ 실행하기'}</button><button className="grade" onClick={()=>void check()} disabled={loading}>✓ 채점하기</button><button className="hint" onClick={()=>setHint(Math.min(hint+1,lesson.hints.length))}>💡 힌트 {hint?`${hint}/${lesson.hints.length}`:'보기'}</button>{lesson.solution&&<button className="grade" onClick={()=>void showSolution()}>◫ 풀이·해설 보기</button>}</div>
          {runResult&&<div className={`terminal ${runResult.success?'':'error'}`}><header><span><i/><i/><i/> Python Console</span><small>{runResult.success?'실행 완료':'실행 오류'}</small></header><pre>{runResult.success?`>>> 실행 결과\n${runResult.output||'(출력 없음)'}`:`>>> 실행 실패\n${runResult.error}`}</pre></div>}{hint>0&&<div className="hint-card"><strong>힌트 {hint}</strong><p>{lesson.hints[hint-1]}</p></div>}{solutionOpen&&lesson.solution&&<div className="hint-card"><strong>풀이·해설</strong><pre style={{margin:'9px 0',padding:10,borderRadius:6,background:'#252c42',color:'#edf1ff',fontSize:11,whiteSpace:'pre-wrap'}}>{lesson.solution}</pre><p>{lesson.solutionExplanation}</p>{solutionNotice&&<p style={{color:'#6270c9',fontWeight:700}}>{solutionNotice}</p>}</div>}{result&&<div className={`result-card ${result.correct?'success':''}`}><strong>{result.executionError?'실행 오류를 먼저 해결해 볼까요?':result.correct?'정답입니다! 잘했어요. 🎉':'조금만 더 생각해 볼까요?'}</strong><p>{result.feedback}</p>{result.output&&<pre>실행 결과: {result.output}</pre>}</div>}</article>
        </div>
      </section>}
      {page==='mistakes'&&<section className="mistakes-page"><div className="title-row"><div><span>SPACED REVIEW</span><h2>다시 보면 내 것이 되는 문제</h2></div><b>{mistakes.length}개</b></div>{mistakes.length?<div className="mistake-grid">{mistakes.map(item=><article key={item.lessonId}><span>{item.unit}</span><h3>{item.title}</h3><p>기대 결과 <code>{item.expectedOutput}</code></p><small>힌트 {item.hintLevel}단계 · 다음 복습 {item.nextReview}</small><button onClick={()=>{const target=lessons.find(lessonItem=>lessonItem.id===item.lessonId);if(target)choose(target)}}>스튜디오에서 다시 풀기 →</button></article>)}</div>:<div className="empty-state"><b>✓</b><h2>지금은 다시 볼 문제가 없어요</h2><p>실행 가능한 오답과 해설을 확인한 문제는 복습 일정에 따라 이곳에 쌓입니다.</p><button onClick={()=>go('studio')}>학습 스튜디오 열기 →</button></div>}</section>}
      {page==='kaggle'&&<section className="kaggle"><article className="kaggle-banner"><span>KAGGLE READY · DATA LAB 0</span><h2>모델보다 먼저, 표 데이터를 읽어요</h2><p>한 행은 한 명의 수강생 기록이고 completed는 예측하려는 결과입니다.</p></article><div className="table-wrap"><table><thead><tr><th>student_id</th><th>study_hours</th><th>attendance</th><th>assignment</th><th>completed</th></tr></thead><tbody><tr><td>101</td><td>18</td><td>0.95</td><td>92</td><td className="yes">1</td></tr><tr><td>102</td><td className="missing">?</td><td>0.62</td><td>58</td><td className="no">0</td></tr><tr><td>103</td><td>22</td><td>0.88</td><td>85</td><td className="yes">1</td></tr></tbody></table></div><div className="terms"><article><b>행 row</b><p>수강생 한 명의 기록입니다.</p></article><article><b>특징 feature</b><p>예측에 쓸 수 있는 입력값입니다.</p></article><article><b>결측치 missing</b><p>모델 전에 처리해야 할 비어 있는 값입니다.</p></article></div><article className="lab-question"><span>CHECK POINT</span><h3>이 데이터에서 예측할 타깃은 무엇일까요?</h3><div>{['student_id','study_hours','completed'].map(answer=><button key={answer} className={labAnswer===answer?'chosen':''} onClick={()=>setLabAnswer(answer)}>{answer}</button>)}</div>{labAnswer&&<p className={labAnswer==='completed'?'good':'warn'}>{labAnswer==='completed'?'정답이에요. completed가 맞히려는 결과, 즉 타깃입니다.':'이 값은 식별자 또는 특징이에요. 우리가 맞히려는 결과는 completed입니다.'}</p>}</article></section>}
    </main>
  </div>
}
