let games=[],
    current=null,
    stack=0,
    genreIndex=0,
    cgIndex=0,
    selectedId=null,
    used=new Set(),
    staffUsed=new Set(),
    mode="all",
    selectedYear="all";

// 현재 플레이 세션에서 이미 출제된 VN ID
let usedQuestionIds=new Set();

// 현재 세션 누적 점수
let totalScore=0;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];


/* =========================================================
   초기화
========================================================= */

function init(){

  games=(window.VN_DATA&&window.VN_DATA.games)||[];

  $("#datasetCount").textContent=
    games.length.toLocaleString();

  buildYears();

  bind();

  newGame();
}


/* =========================================================
   년도 목록
========================================================= */

function buildYears(){

  const sel=$("#yearSelect");

  [...new Set(
    games
      .map(g=>g.year)
      .filter(Boolean)
  )]
  .sort((a,b)=>a-b)
  .forEach(y=>{

    const o=document.createElement("option");

    o.value=y;
    o.textContent=y+"년";

    sel.appendChild(o);

  });
}


/* =========================================================
   출제 가능한 문제 풀 생성
========================================================= */

function pool(){

  let p=games.slice();


  // 인기작 위주
  if(mode==="popular"){

    p.sort(
      (a,b)=>
        (b.votecount||0)-
        (a.votecount||0)
    );

    p=p.slice(
      0,
      Math.min(500,p.length)
    );
  }


  // 년도별
  if(
    mode==="year" &&
    selectedYear!=="all"
  ){

    p=p.filter(
      g=>
        String(g.year)===
        String(selectedYear)
    );
  }


  // 현재 세션에서 이미 나온 문제 제거
  p=p.filter(
    g=>
      !usedQuestionIds.has(g.id)
  );


  return p;
}


/* =========================================================
   등급
========================================================= */

function grade(){

  if(stack<=3){
    return "고수";
  }

  if(stack<=6){
    return "중수";
  }

  return "하수";
}


/* =========================================================
   현재 문제 획득 점수
========================================================= */

function questionScore(){

  return Math.max(
    0,
    1000-(stack*100)
  );
}


/* =========================================================
   화면 스탯 갱신
========================================================= */

function stats(){

  $("#stack").textContent=
    stack;

  $("#grade").textContent=
    grade();

  $("#score").textContent=
    totalScore.toLocaleString();
}


/* =========================================================
   문제 소진 안내
========================================================= */

function showNoQuestionsMessage(){

  let modeName="전체 랜덤";


  if(mode==="popular"){

    modeName="인기작 위주";

  }
  else if(mode==="year"){

    modeName=
      selectedYear==="all"
        ?"전체 연도"
        :`${selectedYear}년`;
  }


  $("#result").className=
    "result bad";


  $("#result").innerHTML=
    `<b>📭 제출할 문제가 없습니다.</b><br>`+
    `${esc(modeName)}에서 현재 세션의 `+
    `출제 가능한 문제가 모두 소진되었습니다.`+
    `<br><small>`+
    `페이지를 새로고침하면 출제 기록이 초기화되어 `+
    `다시 플레이할 수 있습니다.`+
    `</small>`;


  $("#message").textContent=
    "현재 세션에서 출제 가능한 문제가 없습니다.";


  $("#answer").value="";
  $("#answer").disabled=true;

  $("#submit").disabled=true;
  $("#giveUp").disabled=true;

  $("#suggestions").classList.add(
    "hidden"
  );


  $$("[data-hint],[data-staff]")
    .forEach(
      b=>b.disabled=true
    );


  $("#newGame").disabled=false;
}


/* =========================================================
   새 문제
========================================================= */

function newGame(){

  const p=pool();


  // 더 이상 문제가 없을 경우
  if(!p.length){

    current=null;

    stack=0;
    genreIndex=0;
    cgIndex=0;
    selectedId=null;

    used=new Set();
    staffUsed=new Set();


    resetHint("#developer");
    resetHint("#released");
    resetHint("#genres");
    resetHint("#op");
    resetHint("#ed");


    $("#staff").innerHTML="?";

    $("#staff").className=
      "hint-content staff-content unknown";


    $("#cg").innerHTML=
      '<div class="cg-empty">'+
      'CG를 공개하면 이미지가 표시됩니다.'+
      '</div>';


    stats();

    showNoQuestionsMessage();

    return;
  }


  // 랜덤 문제 선택
  current=
    p[
      Math.floor(
        Math.random()*p.length
      )
    ];


  // 현재 세션에서 출제된 문제로 등록
  usedQuestionIds.add(
    current.id
  );


  // 문제별 상태 초기화
  stack=0;

  genreIndex=0;
  cgIndex=0;

  selectedId=null;

  used=new Set();
  staffUsed=new Set();


  $("#answer").value="";
  $("#answer").disabled=false;


  $("#suggestions").classList.add(
    "hidden"
  );


  $("#message").textContent="";


  $("#giveUp").disabled=false;


  $("#result").className=
    "result hidden";

  $("#result").innerHTML="";


  $("#submit").disabled=false;


  resetHint("#developer");
  resetHint("#released");
  resetHint("#genres");
  resetHint("#op");
  resetHint("#ed");


  $("#staff").innerHTML="?";

  $("#staff").className=
    "hint-content staff-content unknown";


  $("#cg").innerHTML=
    '<div class="cg-empty">'+
    'CG를 공개하면 이미지가 표시됩니다.'+
    '</div>';


  $$("[data-hint],[data-staff]")
    .forEach(
      b=>b.disabled=false
    );


  $("#genreButton").textContent=
    "힌트 공개 +1";


  // 누적 점수는 절대 초기화하지 않음
  stats();
}


/* =========================================================
   힌트 초기화
========================================================= */

function resetHint(id){

  $(id).textContent="?";

  $(id).className=
    "hint-content unknown";
}


/* =========================================================
   힌트 스택 증가
========================================================= */

function addStack(){

  stack++;

  stats();
}


/* =========================================================
   텍스트 힌트 공개
========================================================= */

function showText(id,text){

  $(id).textContent=text;

  $(id).classList.remove(
    "unknown"
  );
}


/* =========================================================
   OP / ED 표시
========================================================= */

function song(x){

  return x &&
    (x.artist||x.title)

    ? `${x.artist||"미상"} — ${x.title||"미상"}`

    : "✕ 확인 불가";
}


/* =========================================================
   일반 힌트 공개
========================================================= */

function reveal(type){

  if(!current){
    return;
  }


  // 장르
  if(type==="genres"){

    revealGenre();

    return;
  }


  // CG
  if(type==="cg"){

    revealCG();

    return;
  }


  // 이미 사용한 힌트
  if(used.has(type)){
    return;
  }


  used.add(type);

  addStack();


  const b=
    $(`[data-hint="${type}"]`);

  if(b){
    b.disabled=true;
  }


  // 제작 브랜드
  if(type==="developer"){

    showText(
      "#developer",

      (
        current.developer &&
        current.developer.length
      )

      ?

      current.developer.join(", ")

      :

      "✕ 확인 불가"
    );
  }


  // 최초 발매일
  if(type==="released"){

    showText(
      "#released",

      current.released ||
      "✕ 확인 불가"
    );
  }


  // OP
  if(type==="op"){

    showText(
      "#op",
      song(current.op)
    );
  }


  // ED
  if(type==="ed"){

    showText(
      "#ed",
      song(current.ed)
    );
  }
}


/* =========================================================
   장르 힌트
========================================================= */

function revealGenre(){

  if(!current){
    return;
  }


  const all=
    current.genres||[];


  if(
    genreIndex>=all.length
  ){

    $("#genreButton").disabled=true;

    return;
  }


  addStack();


  genreIndex++;


  showText(
    "#genres",

    all
      .slice(
        0,
        genreIndex
      )
      .join(" / ")

      ||

      "✕ 확인 불가"
  );


  if(
    genreIndex>=all.length
  ){

    $("#genreButton").disabled=true;

    $("#genreButton").textContent=
      "공개 완료";

  }
  else{

    $("#genreButton").textContent=
      `다음 장르 공개 +1 `+
      `(${genreIndex}/${all.length})`;
  }
}


/* =========================================================
   제작진 힌트
========================================================= */

function revealStaff(type){

  if(!current){
    return;
  }


  if(staffUsed.has(type)){
    return;
  }


  staffUsed.add(type);

  addStack();


  const list=
    type==="scenario"
      ? current.scenario
      : current.artists;


  const label=
    type==="scenario"
      ? "시나리오"
      : "원화가";


  if(
    $("#staff")
      .classList
      .contains("unknown")
  ){

    $("#staff").innerHTML="";

    $("#staff")
      .classList
      .remove("unknown");
  }


  const row=
    document.createElement("div");


  row.textContent=
    `${label} : `+
    `${
      list &&
      list.length
        ? list.join(", ")
        : "✕ 확인 불가"
    }`;


  $("#staff")
    .appendChild(row);


  const btn=
    $(`[data-staff="${type}"]`);


  if(btn){
    btn.disabled=true;
  }
}


/* =========================================================
   CG 힌트
========================================================= */

function revealCG(){

  if(!current){
    return;
  }


  /*
    성적/폭력 수치가 높은 CG 제외
  */

  const shots=
    (current.cgs||[])
      .filter(
        x=>
          (
            typeof x.sexual==="number"
              ? x.sexual
              : 0
          ) < 0.5
          &&
          (
            typeof x.violence==="number"
              ? x.violence
              : 0
          ) < 1.5
      );


  if(
    cgIndex>=shots.length
  ){

    if(
      $("#cg")
        .querySelector(".cg-empty")
    ){

      $("#cg").innerHTML=
        '<div class="cg-empty">'+
        '✕ 공개 가능한 CG 없음'+
        '</div>';
    }


    $$('[data-hint="cg"]')
      .forEach(
        b=>b.disabled=true
      );


    return;
  }


  if(
    $("#cg")
      .querySelector(".cg-empty")
  ){

    $("#cg").innerHTML="";
  }


  const s=
    shots[cgIndex++];


  const box=
    document.createElement("div");


  box.className=
    "cg-item";


  if(s.url){

    const img=
      document.createElement("img");


    img.src=s.url;

    img.alt=
      s.caption||"CG";


    box.appendChild(img);

  }
  else{

    box.textContent=
      "CG SAMPLE";
  }


  if(s.caption){

    const cap=
      document.createElement("div");


    cap.className=
      "cg-caption";


    cap.textContent=
      s.caption;


    box.appendChild(cap);
  }


  $("#cg")
    .appendChild(box);


  addStack();


  if(
    cgIndex>=shots.length
  ){

    $$('[data-hint="cg"]')
      .forEach(
        b=>b.disabled=true
      );
  }
}


/* =========================================================
   입력값 정규화
========================================================= */

function norm(s){

  return(s||"")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}


/* =========================================================
   HTML escape
========================================================= */

function esc(s){

  return String(s)
    .replace(
      /[&<>"']/g,

      m=>({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        "\"":"&quot;",
        "'":"&#39;"
      }[m])
    );
}


/* =========================================================
   정답 자동완성
========================================================= */

function suggest(q){

  q=norm(q);


  const box=
    $("#suggestions");


  box.innerHTML="";

  selectedId=null;


  if(!q){

    box.classList.add(
      "hidden"
    );

    return;
  }


  const hits=
    games
      .filter(
        g=>
          [
            g.title,
            ...(g.aliases||[])
          ]
          .some(
            x=>
              norm(x)
                .includes(q)
          )
      )
      .slice(0,8);


  if(!hits.length){

    box.classList.add(
      "hidden"
    );

    return;
  }


  hits.forEach(g=>{

    const d=
      document.createElement("div");


    d.className=
      "suggestion";


    d.innerHTML=
      `${esc(g.title)}`+
      `<small>${
        esc(
          (
            g.aliases &&
            g.aliases[0]
          )||""
        )
      }</small>`;


    d.onclick=()=>{

      selectedId=g.id;

      $("#answer").value=
        g.title;

      box.classList.add(
        "hidden"
      );
    };


    box.appendChild(d);
  });


  box.classList.remove(
    "hidden"
  );
}


/* =========================================================
   정답 공개
========================================================= */

function giveUp(){

  if(!current){
    return;
  }


  $("#suggestions")
    .classList
    .add("hidden");


  $("#result").className=
    "result bad";


  $("#result").innerHTML=
    `<b>🏳️ 정답 공개</b><br>`+
    `<strong>${esc(
      current.title
    )}</strong><br>`+
    `<small>`+
    `이번 문제 획득 점수 0점 · `+
    `누적 ${totalScore.toLocaleString()}점`+
    `</small>`;


  $$("[data-hint],[data-staff]")
    .forEach(
      b=>b.disabled=true
    );


  $("#submit").disabled=true;

  $("#giveUp").disabled=true;

  $("#answer").disabled=true;


  $("#message").textContent=
    "새 문제를 시작하면 다시 도전할 수 있습니다.";
}


/* =========================================================
   정답 제출
========================================================= */

function submit(){

  if(!current){
    return;
  }


  const typed=
    norm(
      $("#answer").value
    );


  const correct=
    selectedId===current.id

    ||

    norm(current.title)===typed

    ||

    (current.aliases||[])
      .map(norm)
      .includes(typed);


  $("#suggestions")
    .classList
    .add("hidden");


  /* =========================
     정답
  ========================= */

  if(correct){

    const earnedScore=
      questionScore();


    // 누적 점수에 추가
    totalScore+=
      earnedScore;


    // 화면 갱신
    stats();


    $("#result").className=
      "result ok";


    $("#result").innerHTML=
      `<b>🎉 정답!</b><br>`+
      `${esc(current.title)}<br>`+
      `<small>`+
      `힌트 스택 ${stack} · `+
      `${grade()} · `+
      `획득 ${earnedScore.toLocaleString()}점 · `+
      `누적 ${totalScore.toLocaleString()}점`+
      `</small>`;


    $$("[data-hint],[data-staff]")
      .forEach(
        b=>b.disabled=true
      );


    $("#submit").disabled=true;
  }


  /* =========================
     오답
  ========================= */

  else{

    // 오답이면 힌트 스택 +1
    addStack();


    // 누적 점수는 변화 없음
    $("#result").className=
      "result bad";


    $("#result").innerHTML=
      `<b>❌ 오답</b><br>`+
      `정답이 아닙니다. 힌트 스택 +1`+
      `<br><small>`+
      `현재 누적 점수 `+
      `${totalScore.toLocaleString()}점`+
      `</small>`;


    $("#message").textContent=
      "다시 도전해보세요.";
  }
}


/* =========================================================
   플레이 모드 변경
========================================================= */

function setMode(next){

  mode=next;


  $$(".mode-btn")
    .forEach(
      b=>
        b.classList.toggle(
          "active",
          b.dataset.mode===mode
        )
    );


  $("#yearSelect")
    .classList
    .toggle(
      "show",
      mode==="year"
    );


  // 새 문제만 시작
  // 누적 점수는 유지
  newGame();
}


/* =========================================================
   이벤트 연결
========================================================= */

function bind(){


  // 일반 힌트
  $$("[data-hint]")
    .forEach(
      b=>
        b.addEventListener(
          "click",
          ()=>reveal(
            b.dataset.hint
          )
        )
    );


  // 제작진 힌트
  $$("[data-staff]")
    .forEach(
      b=>
        b.addEventListener(
          "click",
          ()=>revealStaff(
            b.dataset.staff
          )
        )
    );


  // 플레이 모드
  $$(".mode-btn")
    .forEach(
      b=>
        b.addEventListener(
          "click",
          ()=>setMode(
            b.dataset.mode
          )
        )
    );


  // 년도 선택
  $("#yearSelect")
    .addEventListener(
      "change",
      e=>{

        selectedYear=
          e.target.value;

        newGame();
      }
    );


  // 정답 입력 자동완성
  $("#answer")
    .addEventListener(
      "input",
      e=>
        suggest(
          e.target.value
        )
    );


  // Enter로 정답 제출
  $("#answer")
    .addEventListener(
      "keydown",
      e=>{

        if(e.key==="Enter"){
          submit();
        }
      }
    );


  // 정답 제출
  $("#submit").onclick=
    submit;


  // 정답 공개
  $("#giveUp").onclick=
    giveUp;


  // 새 문제
  $("#newGame").onclick=
    newGame;
}


/* =========================================================
   시작
========================================================= */

init();
