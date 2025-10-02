/* ===== День недели (динамически) ===== */
const ruDays = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
function setDayHeader(d=new Date()){ document.getElementById("dayHeader").textContent = ruDays[d.getDay()]; }
setDayHeader(); setInterval(setDayHeader, 60_000);

/* ===== Локальное хранилище + перенос на новый день ===== */
const KEY_TASKS='dodid_tasks_v1';
const KEY_LAST ='dodid_lastDate';
const START_TASKS=3;

let tasks=[];
try{ tasks=JSON.parse(localStorage.getItem(KEY_TASKS)||'[]')||[] }catch{ tasks=[] }
if(!tasks.length){ tasks = Array.from({length:START_TASKS},()=>({text:'',done:false})) }

function save(){ localStorage.setItem(KEY_TASKS, JSON.stringify(tasks)); }
function todayKey(d=new Date()){ return d.toDateString(); }

function rolloverIfNeeded(){
  const today=todayKey(); const last=localStorage.getItem(KEY_LAST);
  if(last===today) return;
  const carried = tasks.filter(t=>!t.done && (t.text||'').trim()!=='').map(t=>({text:t.text,done:false}));
  tasks = carried.length ? [...carried,{text:'',done:false}] : Array.from({length:START_TASKS},()=>({text:'',done:false}));
  save(); localStorage.setItem(KEY_LAST, today); render();
}
rolloverIfNeeded(); setInterval(rolloverIfNeeded, 60_000);

/* ===== DOM ===== */
const list = document.getElementById('tasks');
const addBtn = document.getElementById('addBtn');

/* Показ тонкой полоски только во время скролла */
let hideTimer=null;
list.addEventListener('scroll', ()=>{
  list.classList.add('scrolling');
  clearTimeout(hideTimer); hideTimer=setTimeout(()=>list.classList.remove('scrolling'), 800);
}, {passive:true});

/* ===== Помощники ===== */
function syncEmpty(el){ (el.textContent||'').trim()==='' ? el.classList.add('empty') : el.classList.remove('empty'); }
function makeTick(){
  const s='http://www.w3.org/2000/svg', svg=document.createElementNS(s,'svg');
  svg.setAttribute('viewBox','0 0 14 14'); svg.classList.add('tick');
  const p1=document.createElementNS(s,'path'); p1.setAttribute('d','M3 7 L6 10');
  const p2=document.createElementNS(s,'path'); p2.setAttribute('d','M6 10 L11 3');
  svg.appendChild(p1); svg.appendChild(p2); return svg;
}
let fontMetricsCache=null;
function computeFontMetricsFor(el){
  const cs=getComputedStyle(el);
  const style=cs.fontStyle||'normal'; const weight=cs.fontWeight||'400';
  const size=cs.fontSize||'18px'; const line=cs.lineHeight && cs.lineHeight!=='normal'? cs.lineHeight:size;
  const family=cs.fontFamily || 'Helvetica Neue, Arial, sans-serif';
  const font=`${style} ${weight} ${size}/${line} ${family}`;
  const c=document.createElement('canvas'), ctx=c.getContext('2d');
  ctx.font=font;
  const m=ctx.measureText('кенгшзхываполжэячсмитью');
  const a=m.actualBoundingBoxAscent||0, d=m.actualBoundingBoxDescent||0;
  return (a||d)? {a,d}:null;
}
function getFontMetrics(el){ if(!fontMetricsCache) fontMetricsCache=computeFontMetricsFor(el); return fontMetricsCache; }

function buildStrike(textWrap, animate=true){
  const old=textWrap.querySelector('.strike-svg'); if(old) old.remove();
  const textEl=textWrap.querySelector('.task-text'); if(!textEl) return;
  syncEmpty(textEl);

  const range=document.createRange(); range.selectNodeContents(textEl);
  const rects=Array.from(range.getClientRects());

  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg'); svg.classList.add('strike-svg');

  const parent=textWrap.getBoundingClientRect();
  svg.setAttribute('width',parent.width); svg.setAttribute('height',parent.height);
  svg.setAttribute('viewBox',`0 0 ${parent.width} ${parent.height}`);

  const fm=getFontMetrics(textEl); const ratio=0.56;

  rects.forEach(r=>{
    const x1=r.left-parent.left, x2=r.right-parent.left, len=Math.max(0,x2-x1);
    if(len<=0) return;
    let y;
    if(fm){ const baseline=(r.bottom-parent.top)-fm.d; const xh=fm.a; y=baseline-(xh/2); }
    else{ y=(r.top-parent.top)+r.height*ratio; }

    const line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y);
    line.setAttribute('x2',x2); line.setAttribute('y2',y);
    line.classList.add('strike-line'); line.style.setProperty('--len', `${len}`);
    if(!animate){ line.style.strokeDashoffset=0; line.style.transition='none'; }
    svg.appendChild(line);
    if(animate){ requestAnimationFrame(()=>{ line.style.strokeDashoffset=0; }); }
  });

  textWrap.appendChild(svg);
}

/* Фокус в конец, чтобы поднять клавиатуру и сразу печатать */
function placeCaretAtEnd(el){
  const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function focusEditable(el){
  requestAnimationFrame(()=>{ el.focus({preventScroll:true}); placeCaretAtEnd(el); try{ el.click(); }catch{} });
}

/* ===== Рендер ===== */
function render(){
  list.innerHTML='';

  tasks.forEach((t,i)=>{
    const li=document.createElement('li'); if(t.done) li.classList.add('done');

    const circle=document.createElement('div'); circle.className='circle';
    if(t.done) circle.appendChild(makeTick());
    circle.addEventListener('pointerdown',()=>circle.classList.add('touch'));
    circle.addEventListener('pointerup',()=>circle.classList.remove('touch'));
    circle.addEventListener('pointercancel',()=>circle.classList.remove('touch'));
    circle.addEventListener('pointerleave',()=>circle.classList.remove('touch'));

    const wrap=document.createElement('div'); wrap.className='textwrap';
    const text=document.createElement('div');
    text.className='task-text'; text.contentEditable='true'; text.spellcheck=false;
    text.textContent=t.text||''; syncEmpty(text);

    wrap.appendChild(text);
    li.appendChild(circle); li.appendChild(wrap); list.appendChild(li);

    circle.addEventListener('click',()=>{
      if((text.textContent||'').trim()==='') return;
      t.done=!t.done; save();
      if(t.done){ li.classList.add('done'); circle.innerHTML=''; circle.appendChild(makeTick()); buildStrike(wrap,true); }
      else{ li.classList.remove('done'); circle.innerHTML=''; const s=wrap.querySelector('.strike-svg'); if(s) s.remove(); }
    });

    text.addEventListener('input',()=>{
      tasks[i].text=text.textContent; save(); syncEmpty(text);
      if(t.done) buildStrike(wrap,false);
    });

    text.addEventListener('keydown',(e)=>{
      const val=(text.textContent||'').trim();
      if((e.key==='Backspace'||e.key==='Delete') && val===''){
        e.preventDefault();
        tasks.splice(i,1); if(tasks.length===0) tasks.push({text:'',done:false});
        save(); render();
      }
    });

    if(t.done) buildStrike(wrap,false);
  });
}

/* ===== Добавление задачи: + рождает кружок, клавиатура сразу ===== */
function addTask(){
  tasks.push({text:'',done:false}); save(); render();
  const last=list.querySelector('li:last-child');
  if(last){
    const c=last.querySelector('.circle'); const tx=last.querySelector('.task-text');
    if(c){ c.classList.add('born'); setTimeout(()=>c.classList.remove('born'), 750); }
    if(tx){ tx.classList.add('empty'); focusEditable(tx); }
  }
}
const addBtnEl=document.getElementById('addBtn');
addBtnEl.addEventListener('pointerdown',()=>addBtnEl.classList.add('pressed'));
addBtnEl.addEventListener('pointerup',()=>addBtnEl.classList.remove('pressed'));
addBtnEl.addEventListener('pointercancel',()=>addBtnEl.classList.remove('pressed'));
addBtnEl.addEventListener('pointerleave',()=>addBtnEl.classList.remove('pressed'));
addBtnEl.addEventListener('click', addTask);

/* Клик вне поля — убрать фокус */
document.addEventListener('pointerdown',(e)=>{
  if(!e.target.closest('.task-text')){
    const a=document.activeElement; if(a && a.blur) a.blur();
  }
},{passive:true});

/* Первичный рендер */
render();

/* Пересчитать зачёркивание при ресайзе */
window.addEventListener('resize', ()=>{
  document.querySelectorAll('#tasks li.done .textwrap').forEach(w=>buildStrike(w,false));
});

/* ===== Поднять док вместе с клавиатурой (iOS visualViewport) ===== */
const rootStyle = document.documentElement.style;
function updateDockForKeyboard(){
  const vv = window.visualViewport;
  if(!vv) return;
  const hidden = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop));
  rootStyle.setProperty('--kb', hidden + 'px');
}
if(window.visualViewport){
  visualViewport.addEventListener('resize', updateDockForKeyboard);
  visualViewport.addEventListener('scroll',  updateDockForKeyboard);
  window.addEventListener('orientationchange', updateDockForKeyboard);
  updateDockForKeyboard();
}
/* ==== Анти-bounce для iOS (чтоб шапка не «ездила») ==== */
(function lockIOSRubberBand(){
  const scroller = document.getElementById('tasks');
  if (!scroller) return;

  // Если список короче экрана — запрещаем «тянуть» страницу
  document.addEventListener('touchmove', (e)=>{
    if (!e.target.closest('#tasks')) e.preventDefault();
  }, { passive: false });

  // На границах списка держим его в пределах (1px хак)
  scroller.addEventListener('touchstart', ()=>{
    const max = scroller.scrollHeight - scroller.clientHeight;
    if (max <= 0) return;                 // нечего скроллить
    if (scroller.scrollTop <= 0) scroller.scrollTop = 1;
    else if (scroller.scrollTop >= max) scroller.scrollTop = max - 1;
  }, { passive: true });

  // Если контента мало, блокируем «пружину» внутри самого списка
  scroller.addEventListener('touchmove', (e)=>{
    if (scroller.scrollHeight <= scroller.clientHeight) e.preventDefault();
  }, { passive: false });
})();
function toggleTask(li) {
  li.classList.toggle("done");
  reorderTasks();
}

function reorderTasks() {
  const tasks = document.querySelector("#tasks");
  const items = Array.from(tasks.children);

  // разделяем выполненные и невыполненные
  const active = items.filter(li => !li.classList.contains("done"));
  const completed = items.filter(li => li.classList.contains("done"));

  // плавно перерисовываем порядок
  [...active, ...completed].forEach(li => tasks.appendChild(li));
}
