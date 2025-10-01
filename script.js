/* ====== ВРЕМЯ & ДЕНЬ НЕДЕЛИ ====== */
function updateTime(){
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes();
  if(m < 10) m = "0"+m;
  document.getElementById("time").textContent = h + ":" + m;
}
setInterval(updateTime, 1000); updateTime();

const ruDays = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
function setDayHeader(date=new Date()){
  document.getElementById('dayHeader').textContent = ruDays[date.getDay()];
}

/* ====== ХРАНИЛИЩЕ ====== */
const KEY_TASKS = 'dodid_tasks_v1';
const KEY_LAST  = 'dodid_lastDate';
const START_TASKS = 3;

let tasks = [];
const list   = document.getElementById('tasks');
const addBtn = document.getElementById('addBtn');

/* Стартовая инициализация: если нет данных — создать 3 пустые строки */
(function hydrate(){
  const raw = localStorage.getItem(KEY_TASKS);
  if(raw === null){
    tasks = Array.from({length:START_TASKS}, ()=>({text:'',done:false}));
    localStorage.setItem(KEY_TASKS, JSON.stringify(tasks));
  }else{
    try{ tasks = JSON.parse(raw) || []; }catch{ tasks = []; }
  }
})();

function save(){ localStorage.setItem(KEY_TASKS, JSON.stringify(tasks)); }

/* ====== ЕЖЕДНЕВНЫЙ ПЕРЕНОС ======
   При новом дне: переносим невыполненные задачи наверх,
   сбрасываем выполненные, обновляем заголовок дня. */
function todayKey(d=new Date()){ return d.toDateString(); }

function rolloverIfNeeded(){
  const today = todayKey();
  const last  = localStorage.getItem(KEY_LAST);

  // всегда обновляем хедер
  setDayHeader(new Date());

  if(last === today){ return; } // тот же день — ничего не делаем

  // Новый день:
  const carried = tasks.filter(t => !t.done && (t.text||'').trim() !== '')
                       .map(t => ({ text: t.text, done:false, carried:true }));

  // Если переносов нет — дадим чистый лист: 3 пустых
  // Если переносы есть — добавим одну пустую для ввода
  if(carried.length === 0){
    tasks = Array.from({length:START_TASKS}, ()=>({text:'',done:false}));
  }else{
    tasks = [...carried, {text:'', done:false}];
  }

  save();
  localStorage.setItem(KEY_LAST, today);
}

/* Запуск пересчёта при старте */
rolloverIfNeeded();

/* ====== ПОЛОСА ПРОКРУТКИ: показывать только во время скролла ====== */
let scrollHideTimer = null;
function tempShowScrollbar(){
  list.classList.add('scrolling');
  clearTimeout(scrollHideTimer);
  scrollHideTimer = setTimeout(()=> list.classList.remove('scrolling'), 800);
}
list.addEventListener('scroll', tempShowScrollbar, { passive:true });

/* ====== Утилиты ====== */
function makeTickSVGStatic(){
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 14 14'); svg.classList.add('tick');
  const p1=document.createElementNS(svgNS,'path'); p1.setAttribute('d','M3 7 L6 10');
  const p2=document.createElementNS(svgNS,'path'); p2.setAttribute('d','M6 10 L11 3');
  svg.appendChild(p1); svg.appendChild(p2); return svg;
}
function syncEmptyClass(el){
  if((el.textContent||'').trim()==='') el.classList.add('empty'); else el.classList.remove('empty');
}

/* === Точные метрики для Y зачёркивания (центр «о» для кириллицы) === */
let fontMetricsCache = null;
function computeFontMetricsFor(el){
  const cs = getComputedStyle(el);
  let font = cs.font;
  if(!font || font === 'normal'){
    const style = cs.fontStyle || 'normal';
    const weight = cs.fontWeight || '400';
    const size = cs.fontSize || '18px';
    const line = cs.lineHeight && cs.lineHeight !== 'normal' ? cs.lineHeight : size;
    const family = cs.fontFamily || 'Helvetica Neue, Arial, sans-serif';
    font = `${style} ${weight} ${size}/${line} ${family}`;
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const sample = 'кенгшзхываполжэячсмитью';
  const m = ctx.measureText(sample);
  const ascent  = m.actualBoundingBoxAscent || 0;
  const descent = m.actualBoundingBoxDescent || 0;
  if(ascent === 0 && descent === 0) return null;
  return { ascent, descent };
}
function getFontMetrics(el){
  if(fontMetricsCache) return fontMetricsCache;
  fontMetricsCache = computeFontMetricsFor(el);
  return fontMetricsCache;
}

/* === Перечёркивание по реальному тексту (SVG по каждой визуальной строке) === */
function buildStrike(textWrap, animate=true){
  const old = textWrap.querySelector('.strike-svg'); if(old) old.remove();
  const textEl = textWrap.querySelector('.task-text'); if(!textEl) return;

  syncEmptyClass(textEl);

  const range = document.createRange(); range.selectNodeContents(textEl);
  const rects = Array.from(range.getClientRects());

  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg'); svg.classList.add('strike-svg');

  const parentRect=textWrap.getBoundingClientRect();
  svg.setAttribute('width', parentRect.width);
  svg.setAttribute('height', parentRect.height);
  svg.setAttribute('viewBox', `0 0 ${parentRect.width} ${parentRect.height}`);

  const metrics = getFontMetrics(textEl);
  const fallbackRatio = 0.56; // если метрик нет

  rects.forEach(r=>{
    const x1 = r.left - parentRect.left;
    const x2 = r.right - parentRect.left;
    const len = Math.max(0, x2 - x1);
    if(len <= 0) return;

    let yLocal;
    if(metrics){
      const baseline = (r.bottom - parentRect.top) - metrics.descent;
      const xHeight  = metrics.ascent; // допущение: «высота строчных» ~ ascent
      yLocal = baseline - (xHeight / 2);
    }else{
      yLocal = (r.top - parentRect.top) + r.height * fallbackRatio;
    }

    const line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', yLocal);
    line.setAttribute('x2', x2); line.setAttribute('y2', yLocal);
    line.classList.add('strike-line');
    line.style.setProperty('--len', `${len}`);

    if(!animate){ line.style.strokeDashoffset=0; line.style.transition='none'; }
    svg.appendChild(line);

    if(animate){ requestAnimationFrame(()=>{ line.style.strokeDashoffset=0; }); }
  });

  textWrap.appendChild(svg);
}

/* ====== РЕНДЕР ====== */
function render(){
  list.innerHTML = '';

  for(let i=0;i<tasks.length;i++){
    const t = tasks[i];

    const li = document.createElement('li');
    if(t.done) li.classList.add('done');

    const circle = document.createElement('div');
    circle.className = 'circle';
    if(t.done){ circle.appendChild(makeTickSVGStatic()); }

    // эффект касания
    circle.addEventListener('pointerdown', ()=> circle.classList.add('touch'));
    circle.addEventListener('pointerup',   ()=> circle.classList.remove('touch'));
    circle.addEventListener('pointercancel',()=> circle.classList.remove('touch'));
    circle.addEventListener('pointerleave', ()=> circle.classList.remove('touch'));

    const textWrap = document.createElement('div');
    textWrap.className = 'textwrap';

    const text = document.createElement('div');
    text.className = 'task-text';
    text.contentEditable = 'true';
    text.spellcheck = false;
    text.dataset.placeholder = 'Новая задача…';
    text.textContent = t.text || '';
    syncEmptyClass(text);

    textWrap.appendChild(text);
    li.appendChild(circle);
    li.appendChild(textWrap);
    list.appendChild(li);

    // клик по кружку
    circle.addEventListener('click', () => {
      if((text.textContent || '').trim() === '') return; // пустую не отмечаем
      t.done = !t.done; save();

      if(t.done){
        li.classList.add('done');
        const old = circle.querySelector('svg.tick'); if(old) old.remove();
        circle.appendChild(makeTickSVGStatic());
        buildStrike(textWrap, true);
      }else{
        li.classList.remove('done');
        const old = circle.querySelector('svg.tick'); if(old) old.remove();
        const oldStrike = textWrap.querySelector('.strike-svg'); if(oldStrike) oldStrike.remove();
      }
    });

    // ввод текста
    text.addEventListener('input', ()=>{
      tasks[i].text = text.textContent;
      save();
      syncEmptyClass(text);
      if(t.done){ buildStrike(textWrap, false); }
    });

    // удаление пустой строки Backspace/Delete — разрешено для любой строки
    text.addEventListener('keydown',(e)=>{
      const val = (text.textContent || '').trim();
      if((e.key === 'Backspace' || e.key === 'Delete') && val === ''){
        e.preventDefault();
        tasks.splice(i,1); save(); render();
      }
    });

    if(t.done){ buildStrike(textWrap, false); }
  }

  // прокладка для комфортной прокрутки вниз
  const spacer = document.createElement('li');
  spacer.className = 'scroll-spacer';
  spacer.setAttribute('aria-hidden','true');
  list.appendChild(spacer);
}

/* ====== ДОБАВИТЬ ЗАДАЧУ (без авто-скролла) ====== */
function addTask(){
  tasks.push({ text:'', done:false });
  save();
  render();

  const lastLi = list.querySelector('li:nth-last-child(2)'); // последняя реальная
  if(lastLi){
    const c = lastLi.querySelector('.circle');
    const tx = lastLi.querySelector('.task-text');
    if(c){ c.classList.add('born'); setTimeout(()=>c.classList.remove('born'), 800); }
    if(tx){ tx.focus(); tx.classList.add('empty'); }
  }
}

/* ====== СВЯЗКА КНОПКИ «+» ====== */
addBtn.addEventListener('pointerdown', ()=> addBtn.classList.add('pressed'));
addBtn.addEventListener('pointerup',   ()=> addBtn.classList.remove('pressed'));
addBtn.addEventListener('pointercancel',()=> addBtn.classList.remove('pressed'));
addBtn.addEventListener('pointerleave', ()=> addBtn.classList.remove('pressed'));
addBtn.addEventListener('click', addTask);

/* ====== ПЕРВЫЙ РЕНДЕР ====== */
render();

/* Пересчитывать перечёркивание при ресайзе (переносы строк меняются) */
window.addEventListener('resize', ()=>{
  document.querySelectorAll('li').forEach(li=>{
    if(li.classList.contains('done')){
      const wrap = li.querySelector('.textwrap');
      if(wrap) buildStrike(wrap, false);
    }
  });
});
/* ====== СКРЫТИЕ КЛАВИАТУРЫ ПО ТАПУ ====== */
document.addEventListener("click", (e) => {
  // если кликнули НЕ по тексту задачи → убираем фокус
  if (!e.target.classList.contains("task-text")) {
    document.activeElement.blur();
  }
});

