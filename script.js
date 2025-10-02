/* ---------------- День недели ---------------- */
const RU_DAYS = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
function setDayHeader(d = new Date()){ const el = document.getElementById("dayHeader"); if (el) el.textContent = RU_DAYS[d.getDay()]; }
setDayHeader(); setInterval(setDayHeader, 60_000);

/* ---------------- Состояние/хранилище ---------------- */
const KEY_TASKS="dodid_tasks_v1", KEY_LAST="dodid_lastDate", START_TASKS=3;
const todayKey = (d=new Date()) => d.toDateString();
let tasks=[]; try{tasks=JSON.parse(localStorage.getItem(KEY_TASKS)||"[]")||[]}catch{tasks=[]}
if(!tasks.length) tasks = Array.from({length:START_TASKS},()=>({text:"",done:false}));
function save(){ localStorage.setItem(KEY_TASKS,JSON.stringify(tasks)); localStorage.setItem(KEY_LAST,todayKey()); }
function rolloverIfNeeded(){
  const last=localStorage.getItem(KEY_LAST), today=todayKey(); if(last===today) return;
  const carried=tasks.filter(t=>!t.done).map(t=>({text:t.text,done:false}));
  const need=Math.max(0,START_TASKS-carried.length);
  tasks=[...carried, ...Array.from({length:need},()=>({text:"",done:false}))];
  save(); render();
}
rolloverIfNeeded(); setInterval(rolloverIfNeeded,60_000);

/* ---------------- DOM ---------------- */
const listEl=document.getElementById("tasks");
const addBtnEl=document.getElementById("addBtn");

/* Fallback на случай, если CSS не загрузился (убрать буллеты сразу) */
if(listEl){ listEl.style.listStyle="none"; listEl.style.margin="0"; }

/* Показ тонкого скроллбара во время прокрутки */
let _scrollHideTimer=null;
if(listEl){
  listEl.addEventListener("scroll",()=>{listEl.classList.add("scrolling");clearTimeout(_scrollHideTimer);_scrollHideTimer=setTimeout(()=>listEl.classList.remove("scrolling"),800);},{passive:true});
}

/* ---------------- Зачёркивание (SVG поверх текста) ---------------- */
const _fontCache=new Map();
function getFontMetrics(el){
  const cs=getComputedStyle(el);
  const font=`${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
  if(_fontCache.has(font)) return _fontCache.get(font);
  const c=document.createElement("canvas"), g=c.getContext("2d");
  try{ g.font=font; }catch{}
  const m=g.measureText("x");
  const a=m.actualBoundingBoxAscent||parseFloat(cs.fontSize)*.8;
  const d=m.actualBoundingBoxDescent||parseFloat(cs.fontSize)*.2;
  const out={a:a,d:d,h:a+d}; _fontCache.set(font,out); return out;
}
function syncEmpty(el){ (el.textContent||"").trim()===""?el.classList.add("empty"):el.classList.remove("empty"); }

function buildStrike(rowEl, active){
  const textEl=rowEl.querySelector(".text");
  let svg=rowEl.querySelector("svg.strike");
  if(!active){ if(svg) svg.remove(); return; }

  const parent=textEl.getBoundingClientRect();
  if(!svg){
    svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.classList.add("strike");
    Object.assign(svg.style,{position:"absolute",left:"0",top:"0",width:"100%",height:"100%"});
    rowEl.appendChild(svg);
  }
  svg.innerHTML="";

  const range=document.createRange(); range.selectNodeContents(textEl);
  const rects=Array.from(range.getClientRects());
  const fm=getFontMetrics(textEl);

  rects.forEach(r=>{
    const x1=r.left-parent.left, x2=r.right-parent.left; if(x2-x1<=0) return;
    const baseline=(r.bottom-parent.top)-fm.d;
    const y=baseline-(fm.a/2);
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",x1.toFixed(1));
    line.setAttribute("y1",y.toFixed(1));
    line.setAttribute("x2",x2.toFixed(1));
    line.setAttribute("y2",y.toFixed(1));
    /* Fallback-стили на случай отсутствия CSS */
    line.setAttribute("stroke","#8a8a8a");
    line.setAttribute("stroke-width","2");
    line.setAttribute("stroke-linecap","round");
    line.setAttribute("opacity","1");
    line.classList.add("strike-line");
    svg.appendChild(line);
  });
}

/* ---------------- Рендер ---------------- */
function createRow(task){
  const li=document.createElement("li"); li.style.position="relative";

  // SVG-галочка слева
  const tick=document.createElementNS("http://www.w3.org/2000/svg","svg");
  tick.setAttribute("viewBox","0 0 14 14");
  /* ЖЁСТКИЙ размер по умолчанию, если CSS не подгрузился */
  tick.setAttribute("width","22"); tick.setAttribute("height","22");
  tick.setAttribute("aria-hidden","true"); tick.classList.add("tick");

  const ring=document.createElementNS(tick.namespaceURI,"path");
  ring.setAttribute("d","M7,1 A6,6 0 1,1 7,13 A6,6 0 1,1 7,1 Z");
  ring.classList.add("tick-ring");
  /* Fallback-стили, если нет CSS */
  ring.setAttribute("fill","none"); ring.setAttribute("stroke","#c9c9c9"); ring.setAttribute("stroke-width","2");

  const mark=document.createElementNS(tick.namespaceURI,"path");
  mark.setAttribute("d","M4 7 L6 9 L10 5");
  mark.classList.add("tick-mark");
  /* Fallback-стили галочки */
  mark.setAttribute("fill","none");
  mark.setAttribute("stroke","#2f9d27"); mark.setAttribute("stroke-width","2.5");
  mark.setAttribute("stroke-linecap","round"); mark.setAttribute("stroke-linejoin","round");
  mark.setAttribute("stroke-dasharray","18"); mark.setAttribute("stroke-dashoffset","18");

  tick.append(ring,mark);

  const text=document.createElement("span");
  text.className="text"; text.contentEditable="true"; text.spellcheck=false;
  text.textContent=task.text||""; syncEmpty(text);

  if(task.done) { li.classList.add("done"); mark.setAttribute("stroke-dashoffset","0"); }

  li.append(tick,text);

  tick.addEventListener("click",(e)=>{
    e.stopPropagation();
    task.done=!task.done; save(); render();
  });

  text.addEventListener("input",()=>{ task.text=text.textContent; syncEmpty(text); save(); });
  text.addEventListener("blur",()=>{
    const v=(text.textContent||"").trim();
    if(v!==text.textContent) text.textContent=v;
    task.text=v; syncEmpty(text); save();
  });

  buildStrike(li, task.done);
  return li;
}

function render(){
  if(!listEl) return;
  listEl.innerHTML="";
  const active=[], completed=[];
  tasks.forEach(t => (t.done?completed:active).push(t));
  [...active,...completed].forEach(t => listEl.appendChild(createRow(t)));
  // Если CSS не загрузился — вручную показать «прорисованную» галочку у .done
  listEl.querySelectorAll("li.done .tick .tick-mark").forEach(p=>p.setAttribute("stroke-dashoffset","0"));
}
render();

/* Добавление задачи */
if(addBtnEl){
  addBtnEl.addEventListener("click",()=>{
    tasks.push({text:"",done:false}); save(); render();
    const last=listEl.querySelector("li:last-child .text");
    if(last){ last.focus(); const sel=getSelection(); const range=document.createRange(); range.selectNodeContents(last); range.collapse(false); sel.removeAllRanges(); sel.addRange(range); }
  });
}

/* Пересборка линий при изменении вьюпорта */
let _resizeRaf=0;
function reflowStrikes(){
  if(!listEl) return;
  cancelAnimationFrame(_resizeRaf);
  _resizeRaf=requestAnimationFrame(()=>{
    listEl.querySelectorAll("li").forEach(li=>buildStrike(li, li.classList.contains("done")));
  });
}
window.addEventListener("resize", reflowStrikes);

/* ---------------- iOS-фиксы (в одном файле) ---------------- */
(function lockIOSRubberBand(){
  const area=document.getElementById("tasks"); if(!area) return;
  document.addEventListener("touchmove",(e)=>{ if(!area.contains(e.target)) e.preventDefault(); },{passive:false});
  ["touchstart","touchmove","touchend","touchcancel"].forEach(ev=>area.addEventListener(ev,()=>{}, {passive:false}));
})();
(function bridgeKeyboard(){
  const vv=window.visualViewport, dock=document.getElementById("dock"); if(!vv||!dock) return;
  function apply(){
    const hidden=Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty("--kb", hidden+"px");
    dock.style.transform = hidden>0 ? `translateY(-${hidden}px)` : "";
  }
  vv.addEventListener("resize", apply); vv.addEventListener("scroll", apply); apply();
})();
