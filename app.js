
let games=[],current=null,stack=0,genreIndex=0,cgIndex=0,selectedId=null,used=new Set(),staffUsed=new Set(),mode="all",selectedYear="all";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const YEARS=[1990,2000,2010,2020];

function init(){
  games=(window.VN_DATA&&window.VN_DATA.games)||[];
  $("#datasetCount").textContent=games.length.toLocaleString();
  buildYears();
  bind();
  newGame();
}
function buildYears(){
  const sel=$("#yearSelect");
  [...new Set(games.map(g=>g.year).filter(Boolean))].sort((a,b)=>a-b).forEach(y=>{
    const o=document.createElement("option");o.value=y;o.textContent=y+"년";sel.appendChild(o);
  });
}
function pool(){
  let p=games.slice();
  if(mode==="popular"){
    p.sort((a,b)=>(b.votecount||0)-(a.votecount||0));
    p=p.slice(0,Math.min(500,p.length));
  }
  if(mode==="year"&&selectedYear!=="all") p=p.filter(g=>String(g.year)===String(selectedYear));
  if(!p.length) p=games.slice();
  return p;
}
function grade(){return stack<=3?"고수":stack<=6?"중수":"하수"}
function score(){return Math.max(0,1000-stack*100)}
function stats(){$("#stack").textContent=stack;$("#grade").textContent=grade();$("#score").textContent=score()}
function newGame(){
  const p=pool(); current=p[Math.floor(Math.random()*p.length)]||games[0];
  stack=0;genreIndex=0;cgIndex=0;selectedId=null;used=new Set();staffUsed=new Set();
  $("#answer").value="";$("#answer").disabled=false;$("#suggestions").classList.add("hidden");$("#message").textContent="";$("#giveUp").disabled=false;
  $("#result").className="result hidden";$("#result").innerHTML="";$("#submit").disabled=false;
  resetHint("#developer");resetHint("#released");resetHint("#genres");resetHint("#op");resetHint("#ed");
  $("#staff").innerHTML="?";$("#staff").className="hint-content staff-content unknown";
  $("#cg").innerHTML='<div class="cg-empty">CG를 공개하면 이미지가 표시됩니다.</div>';
  $$("[data-hint],[data-staff]").forEach(b=>b.disabled=false);
  $("#genreButton").textContent="힌트 공개 +1";
  stats();
}
function resetHint(id){$(id).textContent="?";$(id).className="hint-content unknown"}
function addStack(){stack++;stats()}
function showText(id,text){$(id).textContent=text;$(id).classList.remove("unknown")}
function song(x){return x&&(x.artist||x.title)?`${x.artist||"미상"} — ${x.title||"미상"}`:"✕ 확인 불가"}
function reveal(type){
  if(type==="genres"){revealGenre();return}
  if(type==="cg"){revealCG();return}
  if(used.has(type))return;
  used.add(type);addStack();
  const b=$(`[data-hint="${type}"]`);if(b)b.disabled=true;
  if(type==="developer")showText("#developer",(current.developer&&current.developer.length)?current.developer.join(", "):"✕ 확인 불가");
  if(type==="released")showText("#released",current.released||"✕ 확인 불가");
  if(type==="op")showText("#op",song(current.op));
  if(type==="ed")showText("#ed",song(current.ed));
}
function revealGenre(){
  const all=current.genres||[];
  if(genreIndex>=all.length){$("#genreButton").disabled=true;return}
  addStack();genreIndex++;showText("#genres",all.slice(0,genreIndex).join(" / ")||"✕ 확인 불가");
  if(genreIndex>=all.length){$("#genreButton").disabled=true;$("#genreButton").textContent="공개 완료"}
  else $("#genreButton").textContent=`다음 장르 공개 +1 (${genreIndex}/${all.length})`;
}
function revealStaff(type){
  if(staffUsed.has(type))return;staffUsed.add(type);addStack();
  const list=type==="scenario"?current.scenario:current.artists,label=type==="scenario"?"시나리오":"원화가";
  if($("#staff").classList.contains("unknown"))$("#staff").innerHTML="",$("#staff").classList.remove("unknown");
  const row=document.createElement("div");row.textContent=`${label} : ${list&&list.length?list.join(", "):"✕ 확인 불가"}`;$("#staff").appendChild(row);
  $(`[data-staff="${type}"]`).disabled=true;
}
function revealCG(){
  const shots=(current.cgs||[]).filter(x=>(typeof x.sexual==="number"?x.sexual:0)<0.5 && (typeof x.violence==="number"?x.violence:0)<1.5);
  if(cgIndex>=shots.length){if($("#cg").querySelector(".cg-empty"))$("#cg").innerHTML='<div class="cg-empty">✕ 공개 가능한 CG 없음</div>';$$('[data-hint="cg"]').forEach(b=>b.disabled=true);return}
  if($("#cg").querySelector(".cg-empty"))$("#cg").innerHTML="";
  const s=shots[cgIndex++],box=document.createElement("div");box.className="cg-item";
  if(s.url){const img=document.createElement("img");img.src=s.url;img.alt=s.caption||"CG";box.appendChild(img)}else box.textContent="CG SAMPLE";
  if(s.caption){const cap=document.createElement("div");cap.className="cg-caption";cap.textContent=s.caption;box.appendChild(cap)}
  $("#cg").appendChild(box);addStack();if(cgIndex>=shots.length)$$('[data-hint="cg"]').forEach(b=>b.disabled=true);
}
function norm(s){return(s||"").normalize("NFKC").toLowerCase().trim()}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function suggest(q){
  q=norm(q);const box=$("#suggestions");box.innerHTML="";selectedId=null;
  if(!q){box.classList.add("hidden");return}
  const hits=games.filter(g=>[g.title,...(g.aliases||[])].some(x=>norm(x).includes(q))).slice(0,8);
  if(!hits.length){box.classList.add("hidden");return}
  hits.forEach(g=>{const d=document.createElement("div");d.className="suggestion";d.innerHTML=`${esc(g.title)}<small>${esc((g.aliases&&g.aliases[0])||"")}</small>`;d.onclick=()=>{selectedId=g.id;$("#answer").value=g.title;box.classList.add("hidden")};box.appendChild(d)});
  box.classList.remove("hidden");
}
function giveUp(){
  if(!current)return;
  $("#suggestions").classList.add("hidden");
  $("#result").className="result bad";
  $("#result").innerHTML=`<b>🏳️ 정답 공개</b><br><strong>${esc(current.title)}</strong><br><small>이번 문제는 정답 공개로 종료되었습니다. 힌트 스택 ${stack} · 획득 점수 0점</small>`;
  $$("[data-hint],[data-staff]").forEach(b=>b.disabled=true);
  $("#submit").disabled=true;
  $("#giveUp").disabled=true;
  $("#answer").disabled=true;
  $("#message").textContent="새 문제를 시작하면 다시 도전할 수 있습니다.";
}
function submit(){
  const typed=norm($("#answer").value);
  const correct=selectedId===current.id||norm(current.title)===typed||(current.aliases||[]).map(norm).includes(typed);
  $("#suggestions").classList.add("hidden");
  if(correct){
    $("#result").className="result ok";$("#result").innerHTML=`<b>🎉 정답!</b><br>${esc(current.title)}<br><small>힌트 스택 ${stack} · ${grade()} · ${score()}점</small>`;
    $$("[data-hint],[data-staff]").forEach(b=>b.disabled=true);$("#submit").disabled=true;
  }else{
    addStack();$("#result").className="result bad";$("#result").innerHTML="<b>❌ 오답</b><br>정답이 아닙니다. 힌트 스택 +1";$("#message").textContent="다시 도전해보세요.";
  }
}
function setMode(next){
  mode=next;$$(".mode-btn").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  $("#yearSelect").classList.toggle("show",mode==="year");newGame();
}
function bind(){
  $$("[data-hint]").forEach(b=>b.addEventListener("click",()=>reveal(b.dataset.hint)));
  $$("[data-staff]").forEach(b=>b.addEventListener("click",()=>revealStaff(b.dataset.staff)));
  $$(".mode-btn").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
  $("#yearSelect").addEventListener("change",e=>{selectedYear=e.target.value;newGame()});
  $("#answer").addEventListener("input",e=>suggest(e.target.value));
  $("#answer").addEventListener("keydown",e=>{if(e.key==="Enter")submit()});
  $("#submit").onclick=submit;$("#giveUp").onclick=giveUp;$("#newGame").onclick=newGame;
}
init();
