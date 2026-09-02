import { useEffect, useMemo, useRef, useState } from 'react'
import './AppStudio.css'
import './ConceptGuide.css'
import './TitanicCourse.css'
import './LoadingOverlay.css'
import './AdminReset.css'

type Lesson = { id:string; order:number; level?:number; unit?:string; title:string; concept:string; why:string; example:string; exampleOutput:string; prompt:string; starterCode:string; expectedOutput:string; hints:string[]; solution?:string; solutionExplanation?:string; summary:string; estimatedMinutes:number }
type Mistake = { lessonId:string; title:string; unit:string; code:string; output:string; expectedOutput:string; hintLevel:number; nextReview:string }
type TodayItem = Lesson & { itemType:'review'|'new'; completedToday:boolean }
type Today = { items:TodayItem[]; estimatedMinutes:number; reviewCount:number; newCount:number }
type Result = { correct:boolean; output:string; feedback:string; executionError?:boolean; completedIds?:string[]; dueLessons?:Lesson[]; mistakes?:Mistake[]; todaySession?:Today }
type RunResult = { success:boolean; output:string; error:string }
type SolutionViewResponse = { success:boolean; message:string; nextReview?:string; dueLessons?:Lesson[]; mistakes?:Mistake[]; todaySession?:Today }
type Page = 'today'|'studio'|'mistakes'|'kaggle'
type UserAccess = { nickname:string; accessCode:string }
type KaggleModule = { step:string; title:string; minutes:string; goal:string; concept:string; mission:string; notebookHint:string; question:string; choices:{label:string; value:string; explanation:string}[] }

// Local Vite uses its proxy. In Vercel, VITE_API_URL points at the Render API origin.
const API=(import.meta.env.VITE_API_URL??'/api').replace(/\/$/,'')
const USER_STORAGE_KEY='pycoach-user-access'
const fallback:Lesson[]=[{id:'hello-print',order:1,level:1,unit:'출력',title:'화면에 글자 보여주기',concept:'print()는 컴퓨터에게 내용을 화면에 보여 달라고 하는 명령입니다.',why:'코드를 실행한 결과를 확인하는 가장 첫 도구예요.',example:'print("안녕하세요")',exampleOutput:'안녕하세요',prompt:'화면에 “안녕하세요”를 출력해 보세요.',starterCode:'# 여기에 코드를 작성해 보세요\n',expectedOutput:'안녕하세요',hints:['화면에 내용을 보여줄 때 쓰는 함수를 떠올려 보세요.','글자는 따옴표로 감쌉니다.','print(________)'],summary:'print()는 값을 화면에 출력합니다.',estimatedMinutes:7}]
const KAGGLE_MODULES:KaggleModule[]=[
  {step:'LAB 0',title:'경진대회 지도 읽기',minutes:'8분',goal:'train.csv와 test.csv가 맡은 역할을 구분합니다.',concept:'Titanic에서는 train.csv에만 생존 여부 Survived가 들어 있습니다. 이 열이 우리가 예측할 타깃이고, test.csv에는 답이 없기 때문에 모델의 예측 결과를 채워 넣습니다.',mission:'Kaggle Titanic 데이터 화면에서 train.csv와 test.csv의 열 이름을 비교해 보고, Survived가 어느 파일에만 있는지 찾아보세요.',notebookHint:'# 두 파일의 열 이름을 각각 확인해 보기\n# 어떤 열이 train에만 있는지 메모하기',question:'Titanic에서 모델이 맞혀야 하는 타깃(target)은 무엇일까요?',choices:[{label:'PassengerId',value:'id',explanation:'PassengerId는 승객을 구분하는 번호예요. 예측 결과가 아닙니다.'},{label:'Survived',value:'survived',explanation:'정답이에요. Survived의 0·1 값을 예측해 test.csv에 채웁니다.'},{label:'Name',value:'name',explanation:'Name은 승객 정보이며, 예측할 정답 열은 아닙니다.'}]},
  {step:'LAB 1',title:'Pandas로 데이터 첫 확인',minutes:'12분',goal:'표의 크기·열 종류·결측치를 확인합니다.',concept:'데이터를 읽은 직후에는 head(), info(), isna().sum()으로 표본 행, 자료형, 비어 있는 값을 차례로 살핍니다. 모델보다 먼저 데이터 상태를 이해하는 단계입니다.',mission:'노트북에서 train.csv를 DataFrame으로 읽은 뒤, 행 일부와 자료형·결측치 개수를 차례로 확인해 보세요.',notebookHint:'# pandas를 pd로 불러오기\n# train.csv를 읽어 train에 저장하기\n# train의 정보와 결측치 수 확인하기',question:'각 열의 자료형과 비어 있지 않은 값의 개수를 한 번에 확인할 때 알맞은 메서드는?',choices:[{label:'train.info()',value:'info',explanation:'정답이에요. info()는 열별 자료형과 non-null 개수를 보여 줍니다.'},{label:'train.tail()',value:'tail',explanation:'tail()은 마지막 몇 행을 보는 메서드예요.'},{label:'train.columns',value:'columns',explanation:'columns는 열 이름만 보여 주므로 결측치와 자료형은 알 수 없어요.'}]},
  {step:'LAB 2',title:'생존 패턴 탐색하기',minutes:'12분',goal:'특징과 타깃의 관계를 숫자로 확인합니다.',concept:'평균을 이용하면 0·1 타깃의 비율을 볼 수 있습니다. 예를 들어 성별별 Survived 평균은 각 그룹의 생존 비율로 읽을 수 있어, 모델을 만들기 전 가설을 세우는 데 도움이 됩니다.',mission:'Sex와 Pclass별로 Survived 평균을 구해 보고, 어느 그룹에서 생존 비율이 높은지 한 문장으로 기록해 보세요.',notebookHint:'# 범주형 열로 그룹을 나누기\n# 각 그룹의 Survived 평균을 계산하기\n# 숫자를 생존 비율로 해석하기',question:'성별별 생존 비율을 계산하는 코드로 가장 알맞은 것은?',choices:[{label:'train.groupby("Sex")["Survived"].mean()',value:'groupby',explanation:'정답이에요. Sex로 묶은 뒤 0·1인 Survived의 평균을 구하면 비율이 됩니다.'},{label:'train["Sex"].mean()',value:'sexmean',explanation:'Sex는 글자 범주이므로 평균을 계산할 수 없어요.'},{label:'train.groupby("Survived")["Sex"].mean()',value:'reverse',explanation:'그룹과 평균을 낼 열의 방향이 바뀌었습니다.'}]},
  {step:'LAB 3',title:'결측치와 범주형 값 준비',minutes:'15분',goal:'모델에 넣을 수 있는 형태로 값을 정리합니다.',concept:'Titanic의 Age, Cabin, Embarked 등에는 결측치가 있습니다. 수치형 Age는 중앙값으로 채우는 것부터 시작할 수 있고, 글자인 Sex·Embarked는 숫자로 바꾸거나 원-핫 인코딩해야 모델이 사용할 수 있습니다.',mission:'Age의 결측치를 중앙값으로 채우고, Sex와 Embarked가 글자 데이터라는 점을 확인해 보세요. Cabin은 결측치 비율도 함께 판단해 보세요.',notebookHint:'# Age의 중앙값 구하기\n# 비어 있는 Age를 중앙값으로 채우기\n# 범주형 열을 숫자로 바꾸는 방법 조사하기',question:'Age의 빈 값을 중앙값으로 채우는 방법으로 가장 적절한 것은?',choices:[{label:'train["Age"] = train["Age"].fillna(train["Age"].median())',value:'median',explanation:'정답이에요. Age 열의 중앙값으로 같은 열의 빈 값을 채웁니다.'},{label:'train["Age"] = 0',value:'zero',explanation:'0으로 채울 수도 있지만, 나이가 0인 사람과 결측을 구분하기 어려워져 기준선으로는 중앙값이 더 자연스럽습니다.'},{label:'train.drop(columns=["Survived"])',value:'drop',explanation:'Survived는 타깃이고, 이 코드는 Age 결측치를 처리하지 않습니다.'}]},
  {step:'LAB 4',title:'첫 번째 기준선 모델',minutes:'18분',goal:'훈련 데이터로 분류 모델을 학습하고 예측합니다.',concept:'기준선(baseline)은 복잡함보다 ‘끝까지 작동하는 첫 결과’가 목적입니다. 선택한 특징 X와 정답 y=Survived를 나누고, 전처리한 train 데이터로 fit한 뒤 test 데이터에 predict를 실행합니다.',mission:'사용할 특징 목록을 먼저 정하고, train의 Survived는 정답 y로 분리해 보세요. 그 다음 LogisticRegression 같은 분류 모델의 fit·predict 흐름을 작성해 보세요.',notebookHint:'# features 목록 정하기\n# X와 y를 분리하기\n# model.fit(X, y) 뒤 test 데이터 예측하기',question:'모델을 학습할 때 정답 y로 분리해야 하는 열은 무엇일까요?',choices:[{label:'train["Survived"]',value:'target',explanation:'정답이에요. train.csv의 Survived가 학습용 정답 y입니다.'},{label:'test["Survived"]',value:'testtarget',explanation:'test.csv에는 Survived가 없어요. 그래서 우리가 예측해야 합니다.'},{label:'train["PassengerId"]',value:'passengerid',explanation:'PassengerId는 제출 파일에서 필요하지만, 생존 여부 정답은 아닙니다.'}]},
  {step:'LAB 5',title:'제출 파일 만들기',minutes:'12분',goal:'Kaggle이 읽을 수 있는 submission.csv를 만듭니다.',concept:'Titanic 제출 파일은 PassengerId와 Survived 두 열을 정확한 이름으로 가져야 합니다. 행의 순서는 test.csv와 같아야 하며, CSV를 저장할 때 index=False를 지정해 불필요한 인덱스 열을 빼야 합니다.',mission:'예측값을 Survived 열에 넣고, test.csv의 PassengerId와 함께 DataFrame을 만든 뒤 submission.csv로 저장해 보세요.',notebookHint:'# test의 PassengerId 유지하기\n# 예측값을 Survived 열로 넣기\n# index 없이 CSV 저장하기',question:'Kaggle Titanic 제출 파일에 반드시 포함해야 하는 두 열은?',choices:[{label:'PassengerId, Survived',value:'submission',explanation:'정답이에요. test.csv의 승객 번호와 모델의 생존 예측값을 이 두 열로 제출합니다.'},{label:'Name, Age',value:'profile',explanation:'이들은 승객 정보이며 제출 형식이 아닙니다.'},{label:'Pclass, Fare',value:'features',explanation:'이들은 모델에 쓸 수 있는 특징이지만 제출 파일의 필수 열은 아닙니다.'}]}
]
const levelOf=(lesson:Lesson)=>lesson.level??(lesson.order<=15?1:lesson.order<=21?2:lesson.order<=27?3:lesson.order<=33?4:5)
const levelName=(level:number)=>['','파이썬 첫걸음','조건문으로 판단하기','반복으로 데이터 다루기','자료구조로 데이터 묶기','함수로 분석 로직 만들기'][level]??`레벨 ${level}`
const conceptSteps=(lesson:Lesson)=>{
  const missionSteps:Record<string,string[]>={
    'profile-mission':['입력으로 받은 이름과 직접 정할 과목을 서로 다른 변수로 구분합니다.','두 변수의 값을 한 문장에 넣되, 문장 속 고정 문구·공백·조사는 따로 둡니다.','문장을 만들기 전에 최종 출력 문장을 말로 먼저 읽어 봅니다.'],
    'shopping-mission':['가격과 수량은 계산할 숫자이므로 입력 직후 숫자로 바꿉니다.','두 값의 관계를 곱셈식으로 만들고, 그 결과만 출력합니다.'],
    'study-check-mission':['입력한 글자를 변수에 저장합니다.','특정 글자와 같은 경우, 그렇지 않은 경우의 행동을 나눠 생각합니다.'],
    'average-study-minutes':['합계를 담을 변수를 0에서 시작합니다.','목록을 모두 더한 뒤 항목 수로 나누는 순서로 계산합니다.'],
    'student-average-mission':['목록에서 항목 하나를 꺼내 그 안의 점수를 찾습니다.','반복으로 합계를 만든 뒤 항목 수로 나눕니다.'],
    'student-average-function-mission':['함수는 학생 목록을 받아야 하고, 평균값을 돌려줘야 합니다.','함수 안에서 점수를 합친 뒤 목록 길이로 나누는 순서를 설계합니다.'],
  }
  if(missionSteps[lesson.id])return missionSteps[lesson.id]
  const unitSteps:Record<string,string[]>={
    '출력':['화면에 보여 줄 값이 글자인지 숫자인지 먼저 구분합니다.','글자라면 따옴표로 감싼 뒤 출력합니다.'],
    '변수':['나중에 다시 쓸 값을 의미 있는 이름의 변수에 저장합니다.','저장한 뒤에는 값 대신 변수 이름을 이용해 출력하거나 계산합니다.'],
    '입력':['입력 결과를 담을 변수를 정합니다.','계산이 필요하면 입력값을 숫자로 바꾸고, 문장에 넣을 때는 문자열로 다룹니다.'],
    '연산':['계산할 값과 기준값을 구분합니다.','문제의 말(이상, 나누기 등)에 맞는 연산자를 골라 결과를 출력합니다.'],
    '조건문':['먼저 참 또는 거짓이 되는 조건을 만듭니다.','조건문 줄의 :과 실행 코드의 들여쓰기를 확인합니다.'],
    '반복문':['반복할 목록 또는 범위를 확인하고, 하나씩 받을 변수 이름을 정합니다.','반복 안에서 할 일을 한 단계 들여씁니다.'],
    '리스트':['원하는 값이 몇 번째인지 찾은 뒤, 인덱스는 0부터 센 번호로 바꿉니다.','값을 읽을지 바꿀지에 따라 대괄호 표현을 완성합니다.'],
    '튜플':['튜플에서 필요한 위치를 0부터 세어 인덱스로 찾습니다.','꺼낸 값을 계산식에 연결합니다.'],
    '딕셔너리':['찾으려는 정보의 키 이름을 확인합니다.','대괄호 안에 키를 넣어 값을 꺼낸 뒤 문장이나 계산에 사용합니다.'],
    '함수':['함수가 받을 값과 돌려줄 결과를 먼저 정합니다.','정의·들여쓰기·호출 또는 return의 순서를 나눠 확인합니다.'],
  }
  return unitSteps[lesson.unit??'']??['문제에서 주어진 값과 만들어야 할 결과를 구분합니다.','코드를 작은 단계로 나누어 한 줄씩 작성합니다.']
}
type ConceptReference={title:string; pattern:string; note:string; pitfall:string}
const conceptReference=(lesson:Lesson):ConceptReference=>{
  const missions:Record<string,ConceptReference>={
    'profile-mission':{title:'입력값과 문장을 조합하는 흐름',pattern:'이름 = input()\n주제 = "값"\nprint(f"{이름}님은 {주제}을 공부해요.")',note:'바뀌는 정보는 변수에, 늘 같은 문구는 따옴표 안에 둡니다.',pitfall:'f를 빼거나 변수 이름을 중괄호 밖에 두면 값이 문장에 들어가지 않습니다.'},
    'shopping-mission':{title:'입력한 숫자로 계산하기',pattern:'가격 = int(input())\n수량 = int(input())\n합계 = 가격 * 수량\nprint(합계)',note:'input()의 결과는 글자이므로 계산 전 int()로 바꿉니다.',pitfall:'숫자로 바꾸지 않으면 곱셈이 기대한 계산이 아닌 글자 반복이 될 수 있습니다.'},
    'study-check-mission':{title:'입력에 따라 갈라지는 흐름',pattern:'답 = input()\nif 답 == "기준값":\n    print("참일 때")\nelse:\n    print("거짓일 때")',note:'비교는 ==, 조건문 줄 끝에는 :를 사용합니다.',pitfall:'조건문 아래 실행문은 반드시 한 단계 들여써야 합니다.'},
    'average-study-minutes':{title:'반복으로 평균 만들기',pattern:'합계 = 0\nfor 값 in 목록:\n    합계 += 값\n평균 = 합계 / len(목록)',note:'합계 → 반복 → 나누기의 순서를 먼저 세우면 복잡한 문제도 풀기 쉬워집니다.',pitfall:'합계를 0으로 시작하지 않거나 반복문 밖에서 더하면 원하는 결과가 나오지 않습니다.'},
    'student-average-mission':{title:'중첩 데이터에서 값 꺼내기',pattern:'for 학생 in 학생목록:\n    점수 = 학생["점수"]\n    # 점수를 합계에 더하기',note:'목록에서는 한 명씩, 딕셔너리에서는 키로 필요한 정보를 찾습니다.',pitfall:'목록의 순서와 딕셔너리의 키 접근을 섞어 쓰지 않도록 구분합니다.'},
    'student-average-function-mission':{title:'함수로 평균 계산을 묶기',pattern:'def 평균_계산(값목록):\n    합계 = 0\n    # 합계를 만든 뒤 평균 반환\n    return 결과',note:'함수는 입력(매개변수)과 출력(return)을 함께 설계합니다.',pitfall:'return을 함수 밖에 두거나 호출만 하고 결과를 사용하지 않는 실수를 조심합니다.'},
  }
  if(missions[lesson.id])return missions[lesson.id]
  const byUnit:Record<string,ConceptReference>={
    '출력':{title:'값을 화면에 보여 주는 기본 구조',pattern:'print("보여 줄 글자")\nprint(숫자 또는 변수)',note:'글자는 따옴표로 감싸고, 이미 값이 든 변수는 이름만 씁니다.',pitfall:'글자를 따옴표 없이 쓰면 파이썬은 변수 이름으로 해석합니다.'},
    '변수':{title:'값에 이름을 붙여 다시 쓰기',pattern:'이름 = 값\nprint(이름)',note:'=은 값을 저장한다는 뜻입니다. 오른쪽 값을 먼저 만든 뒤 왼쪽 이름에 담습니다.',pitfall:'변수 이름을 글자처럼 출력하려면 따옴표가 필요하지만, 변수의 값을 출력할 때는 따옴표를 쓰지 않습니다.'},
    '입력':{title:'사용자 입력을 값으로 받기',pattern:'이름 = input()\n숫자 = int(input())',note:'문장용 입력은 그대로, 계산용 입력은 int() 또는 float()로 바꿉니다.',pitfall:'input() 결과는 기본적으로 문자열이라는 점을 놓치기 쉽습니다.'},
    '연산':{title:'값을 계산해 새 결과 만들기',pattern:'결과 = 값1 + 값2\n결과 = 값1 * 값2\nprint(결과)',note:'문제의 말(더하기·곱하기·나머지·이상)을 연산자와 비교식으로 옮겨 봅니다.',pitfall:'나눗셈 결과의 자료형과 연산 순서를 괄호로 점검합니다.'},
    '조건문':{title:'조건에 따라 다른 코드 실행하기',pattern:'if 조건:\n    실행할 코드\nelse:\n    다른 코드',note:'조건이 참일 때와 거짓일 때를 먼저 한국어로 나누어 본 뒤 코드로 옮깁니다.',pitfall:'if 줄 끝의 :과 다음 줄 들여쓰기는 문법의 일부입니다.'},
    '반복문':{title:'여러 값을 하나씩 처리하기',pattern:'for 항목 in 목록:\n    반복할 코드',note:'반복 대상, 하나씩 받을 변수, 반복 안에서 할 일을 분리해 생각합니다.',pitfall:'반복문 안에서 실행할 코드는 반드시 한 단계 들여써야 합니다.'},
    '리스트':{title:'여러 값을 순서대로 보관하기',pattern:'목록 = [값1, 값2, 값3]\n첫번째 = 목록[0]',note:'리스트의 위치 번호(인덱스)는 0부터 시작합니다.',pitfall:'첫 번째 값을 목록[1]로 접근하는 오프바이원 실수를 조심합니다.'},
    '튜플':{title:'순서가 있는 묶음에서 값 꺼내기',pattern:'좌표 = (x, y)\nx값 = 좌표[0]',note:'튜플도 인덱스는 0부터 시작하며, 보통 바꾸지 않을 값을 묶을 때 씁니다.',pitfall:'튜플은 생성 뒤 원소를 바꾸려 하면 오류가 납니다.'},
    '딕셔너리':{title:'이름표(키)로 정보 찾기',pattern:'학생 = {"이름": "값", "점수": 0}\n점수 = 학생["점수"]',note:'순서가 아니라 키 이름으로 값을 찾습니다.',pitfall:'키는 대소문자와 띄어쓰기까지 정확히 일치해야 합니다.'},
    '함수':{title:'반복할 로직을 이름 붙여 재사용하기',pattern:'def 함수이름(매개변수):\n    return 결과\n\n결과값 = 함수이름(값)',note:'정의할 때는 매개변수, 사용할 때는 인자를 넣는다는 차이를 기억합니다.',pitfall:'함수 몸체의 들여쓰기와 return 위치를 먼저 확인합니다.'},
  }
  return byUnit[lesson.unit??'']??{title:'문제를 작은 단계로 나누기',pattern:'# 값 준비하기\n# 처리하기\n# 결과 출력하기',note:'문제의 입력·처리·출력을 나누면 코드의 목적이 분명해집니다.',pitfall:'한 번에 완성하려 하기보다 각 단계의 실행 결과를 먼저 확인합니다.'}
}

export default function AppStudio(){
  const [access,setAccess]=useState<UserAccess|null>(()=>{try{return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)??'null')}catch{return null}})
  const [authMode,setAuthMode]=useState<'register'|'login'>('register')
  const [nicknameInput,setNicknameInput]=useState('')
  const [accessCodeInput,setAccessCodeInput]=useState('')
  const [authError,setAuthError]=useState('')
  const [issuedCode,setIssuedCode]=useState<string|null>(null)
  const [showAccessCode,setShowAccessCode]=useState(false)
  const [page,setPage]=useState<Page>('today')
  const [lessons,setLessons]=useState<Lesson[]>(fallback)
  const [selected,setSelected]=useState('hello-print')
  const [code,setCode]=useState(fallback[0].starterCode)
  const [hint,setHint]=useState(0)
  const [done,setDone]=useState<string[]>([])
  const [today,setToday]=useState<Today|null>(null)
  const [reviews,setReviews]=useState<Lesson[]>([])
  const [mistakes,setMistakes]=useState<Mistake[]>([])
  const [runResult,setRunResult]=useState<RunResult|null>(null)
  const [result,setResult]=useState<Result|null>(null)
  const [loading,setLoading]=useState(false)
  const [initialConnecting,setInitialConnecting]=useState(true)
  const [loadingAction,setLoadingAction]=useState<'run'|'grade'|'reset'|null>(null)
  const [kaggleModule,setKaggleModule]=useState(0)
  const [kaggleAnswer,setKaggleAnswer]=useState<string|null>(null)
  const [solutionOpen,setSolutionOpen]=useState(false)
  const [solutionNotice,setSolutionNotice]=useState('')
  const [adminResetOpen,setAdminResetOpen]=useState(false)
  const [resetNickname,setResetNickname]=useState('')
  const [resetResult,setResetResult]=useState('')
  const [resetError,setResetError]=useState('')
  const codeInputRef=useRef<HTMLTextAreaElement|null>(null)
  const practiceRef=useRef<HTMLElement|null>(null)

  useEffect(()=>{
    async function loadDashboard(){
      try{
        const lessonResponse=await fetch(`${API}/lessons`)
        if(lessonResponse.ok)setLessons(await lessonResponse.json())
        if(!access)return
        const headers={'X-PyCoach-Nickname':encodeURIComponent(access.nickname),'X-PyCoach-Access-Code':access.accessCode}
        const [progressResponse,reviewResponse,mistakeResponse,todayResponse]=await Promise.all([fetch(`${API}/progress`,{headers}),fetch(`${API}/reviews/due`,{headers}),fetch(`${API}/mistakes`,{headers}),fetch(`${API}/today`,{headers})])
        if(progressResponse.ok){const data=await progressResponse.json();setDone(data.completedIds);localStorage.setItem('pycoach-completed',JSON.stringify(data.completedIds))}
        if(reviewResponse.ok)setReviews((await reviewResponse.json()).lessons)
        if(mistakeResponse.ok)setMistakes((await mistakeResponse.json()).mistakes)
        if(todayResponse.ok)setToday(await todayResponse.json())
      }catch{/* The fallback keeps the first lesson visible while the API starts. */}finally{setInitialConnecting(false)}
    }
    void loadDashboard()
  },[access])

  const lesson=lessons.find(item=>item.id===selected)??lessons[0]
  const nextLesson=lessons[lessons.findIndex(item=>item.id===lesson.id)+1]
  const levels=useMemo(()=>Array.from({length:5},(_,index)=>lessons.filter(item=>levelOf(item)===index+1)),[lessons])
  const progress=Math.round(done.length/lessons.length*100)
  const next=today?.items.find(item=>!item.completedToday)
  const reviewItems=today?.items.filter(item=>item.itemType==='review'&&!item.completedToday)??[]
  const activeKaggleModule=KAGGLE_MODULES[kaggleModule]
  const isAdmin=access?.nickname==='향유랑'

  function go(destination:Page){setPage(destination);window.scrollTo({top:0,behavior:'smooth'})}
  function choose(item:Lesson){setSelected(item.id);setCode(item.starterCode);setHint(0);setResult(null);setRunResult(null);setSolutionOpen(false);setSolutionNotice('');setPage('studio');requestAnimationFrame(()=>requestAnimationFrame(()=>practiceRef.current?.scrollIntoView({behavior:'smooth',block:'start'})))}
  function update(data:Partial<Result>&Partial<SolutionViewResponse>){if(data.todaySession)setToday(data.todaySession);if(data.dueLessons)setReviews(data.dueLessons);if(data.mistakes)setMistakes(data.mistakes);if(data.completedIds){setDone(data.completedIds);localStorage.setItem('pycoach-completed',JSON.stringify(data.completedIds))}}

  function apiFetch(path:string, init:RequestInit={}){
    if(!access)throw new Error('사용자 정보가 없어요.')
    return fetch(`${API}${path}`,{...init,headers:{...init.headers,'X-PyCoach-Nickname':encodeURIComponent(access.nickname),'X-PyCoach-Access-Code':access.accessCode}})
  }
  async function submitAccess(){
    setAuthError('')
    try{
      const response=await fetch(`${API}/users/${authMode==='register'?'register':'login'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(authMode==='register'?{nickname:nicknameInput}:{nickname:nicknameInput,accessCode:accessCodeInput})})
      const data=await response.json()
      if(!response.ok)throw new Error(data.detail??'사용자 정보를 확인할 수 없어요.')
      const nextAccess={nickname:data.nickname,accessCode:data.accessCode} as UserAccess
      localStorage.setItem(USER_STORAGE_KEY,JSON.stringify(nextAccess));setAccess(nextAccess);setIssuedCode(authMode==='register'?data.accessCode:null);setDone([])
    }catch(error){setAuthError(error instanceof Error?error.message:'사용자 정보를 확인할 수 없어요.')}
  }
  function switchUser(){localStorage.removeItem(USER_STORAGE_KEY);setAccess(null);setIssuedCode(null);setAuthMode('login');setNicknameInput('');setAccessCodeInput('');setDone([]);setToday(null);setReviews([]);setMistakes([])}

  function indentCode(){
    const input=codeInputRef.current
    if(!input)return
    const start=input.selectionStart
    const end=input.selectionEnd
    const lineStart=code.lastIndexOf('\n',Math.max(0,start-1))+1
    const selectedLines=code.slice(lineStart,end)
    const indented=selectedLines.split('\n').map(line=>`    ${line}`).join('\n')
    const nextCode=`${code.slice(0,lineStart)}${indented}${code.slice(end)}`
    const lineCount=selectedLines.split('\n').length
    setCode(nextCode)
    setResult(null)
    setRunResult(null)
    requestAnimationFrame(()=>{
      const updated=codeInputRef.current
      if(!updated)return
      updated.focus()
      updated.setSelectionRange(start+4,end+4*lineCount)
    })
  }
  async function run(){setLoading(true);setLoadingAction('run');setResult(null);setRunResult(null);try{const response=await fetch(`${API}/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id,code})});const data=await response.json().catch(()=>null);if(!response.ok){setRunResult({success:false,output:'',error:typeof data?.detail==='string'?data.detail:`실행 서버가 ${response.status} 상태로 응답했어요.`});return}setRunResult(data as RunResult)}catch(error){const message=error instanceof Error?error.message:'알 수 없는 네트워크 오류';setRunResult({success:false,output:'',error:`실행 서버에 요청하지 못했어요. ${message}`})}finally{setLoading(false);setLoadingAction(null)}}
  async function check(){setLoading(true);setLoadingAction('grade');setResult(null);try{const response=await apiFetch('/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id,code,hintLevel:hint})});const data=await response.json().catch(()=>null);if(!response.ok){const detail=typeof data?.detail==='string'?data.detail:`채점 서버가 ${response.status} 상태로 응답했어요.`;setResult({correct:false,output:'',feedback:response.status===401?`${detail} 상단의 사용자 전환에서 닉네임과 6자리 접속 코드로 다시 로그인해 주세요.`:detail});return}setResult(data as Result);update(data as Result)}catch(error){const message=error instanceof Error?error.message:'알 수 없는 네트워크 오류';setResult({correct:false,output:'',feedback:`채점 요청에 실패했어요. ${message}`})}finally{setLoading(false);setLoadingAction(null)}}
  async function resetAccessCode(){setResetError('');setResetResult('');setLoading(true);setLoadingAction('reset');try{const response=await apiFetch('/users/reset-access-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:resetNickname})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(typeof data?.detail==='string'?data.detail:'접속 코드를 재발급하지 못했어요.');if(access&&data.nickname===access.nickname){const refreshedAccess={...access,accessCode:data.accessCode};localStorage.setItem(USER_STORAGE_KEY,JSON.stringify(refreshedAccess));setAccess(refreshedAccess)}setResetResult(`${data.nickname}님의 새 접속 코드: ${data.accessCode}`)}catch(error){setResetError(error instanceof Error?error.message:'접속 코드를 재발급하지 못했어요.')}finally{setLoading(false);setLoadingAction(null)}}
  async function showSolution(){setSolutionOpen(true);if(!lesson.solution)return;try{const response=await apiFetch('/solution-viewed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id})});if(!response.ok)throw Error();const data:SolutionViewResponse=await response.json();setSolutionNotice(data.message);update(data)}catch{setSolutionNotice('해설은 열었어요. 복습 일정은 백엔드 연결 후 다시 저장됩니다.')}}
  const Nav=({id,label,icon}:{id:Page;label:string;icon:string})=><button className={page===id?'active':''} onClick={()=>go(id)}><span>{icon}</span>{label}</button>
  const loadingPopup=initialConnecting||loadingAction?<div className="loading-overlay" role="status" aria-live="polite"><section><span className="loading-spinner" aria-hidden="true"/><p>{initialConnecting?'SERVER CONNECTION':loadingAction==='run'?'CODE EXECUTION':loadingAction==='grade'?'ANSWER CHECK':'ACCESS CODE RESET'}</p><h2>{initialConnecting?'서버 연결 중':loadingAction==='run'?'코드를 실행하고 있어요':loadingAction==='grade'?'답안을 채점하고 있어요':'새 접속 코드를 발급하고 있어요'}</h2><small>{initialConnecting?'학습 기록을 불러오고 있어요. 무료 서버가 잠시 멈춰 있었다면 최대 1분 정도 걸릴 수 있어요.':'잠시만 기다려 주세요. 작업이 끝나면 결과를 바로 보여 드릴게요.'}</small></section></div>:null
  const adminResetPopup=adminResetOpen?<div className="admin-reset-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-reset-title"><section><button className="admin-reset-close" type="button" onClick={()=>setAdminResetOpen(false)} aria-label="접속 코드 재발급 창 닫기">×</button><p>ADMIN ONLY</p><h2 id="admin-reset-title">접속 코드 재발급</h2><small>닉네임을 입력하면 기존 코드는 즉시 무효화됩니다. 학습 진도는 유지됩니다.</small><label htmlFor="reset-nickname">사용자 닉네임</label><input id="reset-nickname" value={resetNickname} onChange={event=>setResetNickname(event.target.value)} placeholder="재발급할 닉네임" autoCapitalize="off" autoCorrect="off"/><button className="admin-reset-submit" type="button" disabled={!resetNickname.trim()||loading} onClick={()=>void resetAccessCode()}>새 접속 코드 발급</button>{resetError&&<strong className="admin-reset-error">{resetError}</strong>}{resetResult&&<strong className="admin-reset-result">{resetResult}</strong>}<em>새 코드는 사용자에게 안전한 방법으로 전달해 주세요.</em></section></div>:null

  if(!access||issuedCode)return <><main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20,background:'#f7f8fc',color:'#29354c'}}><section style={{width:'min(440px,100%)',padding:30,border:'1px solid #e2e6f0',borderRadius:16,background:'#fff',boxShadow:'0 16px 38px #dfe3ef'}}><p style={{margin:0,color:'#7180db',fontSize:11,fontWeight:800,letterSpacing:1}}>PYCOACH PERSONAL PROGRESS</p><h1 style={{margin:'10px 0 8px'}}>나만의 학습 기록을 시작해요</h1>{issuedCode?<><p style={{color:'#68758d',lineHeight:1.6}}>다른 기기에서 같은 진도를 이어갈 때 필요한 접속 코드예요. 안전한 곳에 저장해 주세요.</p><strong style={{display:'block',margin:'18px 0',padding:16,borderRadius:10,background:'#f0f2ff',color:'#5667cf',fontSize:30,letterSpacing:8,textAlign:'center'}}>{issuedCode}</strong><button onClick={()=>setIssuedCode(null)} style={{width:'100%',border:0,borderRadius:8,padding:12,background:'#596bdb',color:'#fff',fontWeight:800}}>코드를 저장했어요</button></>:<><p style={{color:'#68758d',lineHeight:1.6}}>닉네임은 친구들과 겹치지 않게 한 번만 만들어요. 접속 코드는 다른 기기에서 내 기록을 이어갈 때 사용합니다.</p><div style={{display:'flex',gap:8,margin:'20px 0 14px'}}><button onClick={()=>setAuthMode('register')} style={{border:0,background:'transparent',color:authMode==='register'?'#5667cf':'#8c96a7',fontWeight:800}}>처음 시작</button><button onClick={()=>setAuthMode('login')} style={{border:0,background:'transparent',color:authMode==='login'?'#5667cf':'#8c96a7',fontWeight:800}}>다른 기기에서 이어하기</button></div><input value={nicknameInput} onChange={event=>setNicknameInput(event.target.value)} placeholder="닉네임 (2~16자)" style={{width:'100%',marginBottom:10,padding:12,border:'1px solid #dce1ed',borderRadius:8}}/>{authMode==='login'&&<input value={accessCodeInput} onChange={event=>setAccessCodeInput(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6자리 접속 코드" inputMode="numeric" style={{width:'100%',marginBottom:10,padding:12,border:'1px solid #dce1ed',borderRadius:8}}/>}{authError&&<p style={{color:'#bd625a',fontSize:12}}>{authError}</p>}<button onClick={()=>void submitAccess()} style={{width:'100%',border:0,borderRadius:8,padding:12,background:'#596bdb',color:'#fff',fontWeight:800}}>{authMode==='register'?'닉네임으로 시작하기':'내 기록 불러오기'}</button></>}</section></main>{loadingPopup}</>

  return <div className="studio-shell">
    <aside className="studio-sidebar"><button className="studio-brand" onClick={()=>go('today')}><b>&lt;/&gt;</b><span>PyCoach<small>PYTHON LEARNING LAB</small></span></button><p>학습 메뉴</p><nav><Nav id="today" icon="⌂" label="오늘의 학습"/><Nav id="studio" icon="▦" label="학습 스튜디오"/><Nav id="mistakes" icon="◌" label="오답노트"/><Nav id="kaggle" icon="◇" label="Kaggle 준비"/></nav><div className="side-meter"><small>전체 진도</small><strong>{progress}%</strong><i><em style={{width:`${progress}%`}}/></i><span>{done.length} / {lessons.length} 레슨 완료</span></div></aside>
    <main className="studio-main">
      <header className="studio-header"><div><span>PYCOACH</span><h1>{page==='today'?'오늘의 학습':page==='studio'?'학습 스튜디오':page==='mistakes'?'오답노트':'Kaggle Ready'}</h1><p>{page==='studio'?'왼쪽에서 레슨을 고르고 개념을 확인한 뒤, 오른쪽에서 직접 실행해 보세요.':page==='today'?'오늘 필요한 만큼만 학습하고, 기억이 흐려지기 전에 다시 만나요.':page==='mistakes'?'틀린 문제와 해설을 본 문제는 일정 시간이 지난 뒤 다시 풉니다.':'경진대회 전에 표 데이터를 읽고, 타깃을 먼저 판단해 봅니다.'}</p></div><div style={{display:'grid',gap:7,justifyItems:'end'}}><b className="streak">🔥 3일 연속</b>{isAdmin&&<button onClick={()=>{setAdminResetOpen(true);setResetNickname('');setResetResult('');setResetError('')}} style={{border:0,background:'transparent',color:'#9a6d35',fontSize:11,cursor:'pointer'}}>관리자 · 접속 코드 재발급</button>}<button onClick={()=>setShowAccessCode(!showAccessCode)} style={{border:0,background:'transparent',color:'#6878d2',fontSize:11,cursor:'pointer'}}>내 접속 코드 {showAccessCode?access.accessCode:'보기'}</button><button onClick={switchUser} style={{border:0,background:'transparent',color:'#6878d2',fontSize:11,cursor:'pointer'}}>{access.nickname} · 사용자 전환</button></div></header>
      {page==='today'&&<section>
        <article className="today-banner"><span>오늘의 작은 목표</span><h2>{next?next.itemType==='review'?'복습 문제를 다시 꺼내 볼까요?':`${next.title}을(를) 시작해 볼까요?`:'오늘 계획을 모두 마쳤어요!'}</h2><p>{next?`약 ${today?.estimatedMinutes??next.estimatedMinutes}분이면 충분해요. 이해한 뒤 직접 작성해 보세요.`:'다음 복습이 준비되면 이곳에서 알려 드릴게요.'}</p>{next&&<button onClick={()=>choose(next)}>학습 시작하기 →</button>}</article>
        <div className="today-stats"><article><small>전체 진도</small><strong>{progress}%</strong><span>{done.length}/{lessons.length} 레슨</span></article><article><small>오늘의 복습</small><strong>{today?.reviewCount??reviews.length}</strong><span>기억을 다시 꺼낼 문제</span></article><article><small>오답·해설 복습</small><strong>{mistakes.length}</strong><span>다시 볼 문제</span></article></div>
        <section className="today-plan"><div className="title-row"><div><span>SPACED REVIEW</span><h2>복습 우선순위</h2></div><button onClick={()=>go('mistakes')}>오답노트 열기 →</button></div>{reviewItems.length>0?reviewItems.map(item=><button key={item.id} onClick={()=>choose(item)} className="plan-row"><b>↻</b><span><strong>{item.title}</strong><small>기억을 확인하는 복습 문제</small></span><em>다시 풀기</em></button>):<div className="empty-state" style={{padding:'20px'}}><b>✓</b><p>오늘 예정된 복습은 없어요. 해설을 본 문제는 내일 이곳에 나타납니다.</p></div>}</section>
        <section className="today-plan" style={{marginTop:14}}><div className="title-row"><div><span>TODAY PLAN</span><h2>오늘의 순서</h2></div><button onClick={()=>go('studio')}>학습 스튜디오 열기 →</button></div>{today?.items.map(item=><button key={item.id} onClick={()=>choose(item)} className="plan-row"><b>{item.completedToday?'✓':item.itemType==='review'?'↻':'+'}</b><span><strong>{item.title}</strong><small>{item.itemType==='review'?'복습':'새 레슨'}</small></span><em>{item.completedToday?'완료':'시작'}</em></button>)}</section>
      </section>}
      {page==='studio'&&<section className="learning-studio">
        <aside className="course-panel"><div className="course-panel-head"><span>LEARNING COURSE</span><h2>레벨별 코스</h2><p>제목을 누르면 오른쪽 실습 문제가 바뀝니다.</p></div>{levels.map((items,index)=>items.length>0&&<details key={index} open={levelOf(lesson)===index+1}><summary><span>LEVEL {String(index+1).padStart(2,'0')}</span><strong>{levelName(index+1)}</strong><small>{items.filter(item=>done.includes(item.id)).length}/{items.length}</small></summary>{items.map(item=><button key={item.id} className={item.id===lesson.id?'selected':''} onClick={()=>choose(item)}><b>{done.includes(item.id)?'✓':item.order}</b><span>{item.title}<small>{item.unit}</small></span></button>)}</details>)}</aside>
        <div className="lesson-panel"><div className="selected-head"><span>LEVEL {levelOf(lesson)} · {lesson.unit}</span><h2>{lesson.title}</h2><p>{lesson.summary}</p></div><details className="concept-details"><summary><span>개념 설명</span><b>열기 +</b></summary><div>{(()=>{const reference=conceptReference(lesson);return <><section className="concept-intro"><p className="concept-eyebrow">핵심 원리</p><h3>{reference.title}</h3><p>{lesson.concept}</p><p className="concept-why">{lesson.why}</p></section><div className="concept-grid"><section className="concept-block"><p className="concept-eyebrow">문법 구조</p><pre className="syntax-pattern"><code>{reference.pattern}</code></pre><p>{reference.note}</p></section><section className="concept-block pitfall"><p className="concept-eyebrow">자주 막히는 지점</p><p>{reference.pitfall}</p></section></div><section className="solve-plan"><p className="concept-eyebrow">문제 풀이 순서</p><ol>{conceptSteps(lesson).map((step,index)=><li key={step}><b>{index+1}</b><span>{step}</span></li>)}</ol><p className="answer-note">위 문법 구조는 원리를 익히기 위한 예시입니다. 현재 문제의 완성 답안은 보여주지 않아요.</p></section></>})()}</div></details>
          <article ref={practiceRef} className="practice-card"><span>CODE PRACTICE</span><h3>{lesson.prompt}</h3><label htmlFor="code">코드 작성</label><textarea ref={codeInputRef} id="code" value={code} onChange={event=>{setCode(event.target.value);setResult(null);setRunResult(null)}} onKeyDown={event=>{if(event.key==='Tab'){event.preventDefault();indentCode()}}} spellCheck="false" autoCapitalize="off" autoCorrect="off" autoComplete="off"/><div className="code-meta"><span>Python</span><button className="indent-button" type="button" onClick={indentCode} title="선택한 줄 또는 현재 줄 들여쓰기">↹ 들여쓰기</button><span>UTF-8</span></div><div className="practice-actions"><button className="run" onClick={()=>void run()} disabled={loading}>{loading?'실행 중...':'▷ 실행하기'}</button><button className="grade" onClick={()=>void check()} disabled={loading}>✓ 채점하기</button><button className="hint" onClick={()=>setHint(Math.min(hint+1,lesson.hints.length))}>💡 힌트 {hint?`${hint}/${lesson.hints.length}`:'보기'}</button>{lesson.solution&&<button className="grade" onClick={()=>void showSolution()}>◫ 풀이·해설 보기</button>}</div>
          {runResult&&<div className={`terminal ${runResult.success?'':'error'}`}><header><span><i/><i/><i/> Python Console</span><small>{runResult.success?'실행 완료':'실행 오류'}</small></header><pre>{runResult.success?`>>> 실행 결과\n${runResult.output||'(출력 없음)'}`:`>>> 실행 실패\n${runResult.error}`}</pre></div>}{hint>0&&<div className="hint-card"><strong>힌트 {hint}</strong><p>{lesson.hints[hint-1]}</p></div>}{solutionOpen&&lesson.solution&&<div className="hint-card"><strong>풀이·해설</strong><pre style={{margin:'9px 0',padding:10,borderRadius:6,background:'#252c42',color:'#edf1ff',fontSize:11,whiteSpace:'pre-wrap'}}>{lesson.solution}</pre><p>{lesson.solutionExplanation}</p>{solutionNotice&&<p style={{color:'#6270c9',fontWeight:700}}>{solutionNotice}</p>}</div>}{result&&<div className={`result-card ${result.correct?'success':''}`}><strong>{result.executionError?'실행 오류를 먼저 해결해 볼까요?':result.correct?'정답입니다! 잘했어요. 🎉':'조금만 더 생각해 볼까요?'}</strong><p>{result.feedback}</p>{result.output&&<pre>실행 결과: {result.output}</pre>}{result.correct&&nextLesson&&<button className="next-lesson" type="button" onClick={()=>choose(nextLesson)}>다음 문제: {nextLesson.title} →</button>}</div>}</article>
        </div>
      </section>}
      {page==='mistakes'&&<section className="mistakes-page"><div className="title-row"><div><span>SPACED REVIEW</span><h2>다시 보면 내 것이 되는 문제</h2></div><b>{mistakes.length}개</b></div>{mistakes.length?<div className="mistake-grid">{mistakes.map(item=><article key={item.lessonId}><span>{item.unit}</span><h3>{item.title}</h3><p>기대 결과 <code>{item.expectedOutput}</code></p><small>힌트 {item.hintLevel}단계 · 다음 복습 {item.nextReview}</small><button onClick={()=>{const target=lessons.find(lessonItem=>lessonItem.id===item.lessonId);if(target)choose(target)}}>스튜디오에서 다시 풀기 →</button></article>)}</div>:<div className="empty-state"><b>✓</b><h2>지금은 다시 볼 문제가 없어요</h2><p>실행 가능한 오답과 해설을 확인한 문제는 복습 일정에 따라 이곳에 쌓입니다.</p><button onClick={()=>go('studio')}>학습 스튜디오 열기 →</button></div>}</section>}
      {page==='kaggle'&&<section className="kaggle titanic-course"><article className="kaggle-banner"><span>KAGGLE READY · TITANIC COURSE</span><h2>타이타닉으로 배우는 첫 데이터 경진대회</h2><p>데이터 읽기부터 제출 파일 만들기까지, 작은 기준선 모델을 완성해 봅니다.</p><div className="kaggle-facts"><b>6개 랩</b><span>약 1시간 15분</span><span>pandas · scikit-learn</span></div></article><div className="titanic-layout"><aside className="kaggle-course-nav"><p>COURSE MAP</p>{KAGGLE_MODULES.map((module,index)=><button key={module.step} className={index===kaggleModule?'active':''} onClick={()=>{setKaggleModule(index);setKaggleAnswer(null)}}><b>{String(index).padStart(2,'0')}</b><span><small>{module.step} · {module.minutes}</small>{module.title}</span></button>)}</aside><article className="titanic-lesson"><div className="titanic-lesson-head"><span>{activeKaggleModule.step} · {activeKaggleModule.minutes}</span><h3>{activeKaggleModule.title}</h3><p>{activeKaggleModule.goal}</p></div>{kaggleModule===0&&<div className="table-wrap"><table><thead><tr><th>파일</th><th>PassengerId</th><th>특징 예시</th><th>Survived</th><th>용도</th></tr></thead><tbody><tr><td>train.csv</td><td>있음</td><td>Pclass, Sex, Age, Fare</td><td className="yes">있음</td><td>학습</td></tr><tr><td>test.csv</td><td>있음</td><td>Pclass, Sex, Age, Fare</td><td className="missing">없음</td><td>예측·제출</td></tr></tbody></table></div>}<section className="titanic-concept"><p className="kaggle-label">핵심 개념</p><p>{activeKaggleModule.concept}</p></section><section className="titanic-mission"><p className="kaggle-label">노트북 미션</p><h4>{activeKaggleModule.mission}</h4><pre>{activeKaggleModule.notebookHint}</pre><small>위 문장은 작성 순서를 위한 안내입니다. 실제 코드는 Kaggle Notebook에서 직접 완성해 보세요.</small></section><section className="lab-question titanic-check"><span>CHECK POINT</span><h3>{activeKaggleModule.question}</h3><div>{activeKaggleModule.choices.map(choice=><button key={choice.value} className={kaggleAnswer===choice.value?'chosen':''} onClick={()=>setKaggleAnswer(choice.value)}>{choice.label}</button>)}</div>{kaggleAnswer&&<p className={activeKaggleModule.choices.find(choice=>choice.value===kaggleAnswer)?.value===activeKaggleModule.choices[1]?.value?'good':'warn'}>{activeKaggleModule.choices.find(choice=>choice.value===kaggleAnswer)?.explanation}</p>}</section>{kaggleModule<KAGGLE_MODULES.length-1&&<button className="kaggle-next" onClick={()=>{setKaggleModule(current=>current+1);setKaggleAnswer(null)}}>다음 랩: {KAGGLE_MODULES[kaggleModule+1].title} →</button>}</article></div><div className="titanic-finish"><b>완주 체크리스트</b><span>데이터 확인 → 결측치 처리 → 기준선 모델 → submission.csv 생성 → Kaggle 제출</span></div></section>}
    </main>{loadingPopup}{adminResetPopup}
  </div>
}
