/* Время */
  function updateTime(){
    const now = new Date();
    let h = now.getHours(), m = now.getMinutes();
    if(m < 10) m = "0"+m;
    document.getElementById("time").textContent = h + ":" + m;
  }
  setInterval(updateTime, 1000); updateTime();

  /* Хранилище */
  const KEY='dodid_tasks_v1', START_TASKS=3;
  let tasks=[];
  const raw=localStorage.getItem(KEY);
  if(raw===null){ tasks=Array.from({length:START_TASKS},()=>({text:'',done:false})); localStorage.setItem(KEY, JSON.stringify(tasks)); }
  else{ try{ tasks=JSON.parse(raw)||[] }catch{ tasks=[] } }
  function save(){ localStorage.setItem(KEY, JSON.stringify(tasks)); }

  const list=document.getElementById('tasks');
  const addBtn=document.getElementById('addBtn');
  let scrollHideTimer=null;

  /* Показ нативной тонкой полосы только во время СВОЕГО скролла пользователя */
  function tempShowScrollbar(){
    list.classList.add('scrolling');
    clearTimeout(scrollHideTimer);
    scrollHideTimer=setTimeout(()=> list.classList.remove('scrolling'), 800);
  }
  list.addEventListener('scroll', tempShowScrollbar, {passive:true});

  /* Галочка (статично) */
  function makeTickSVGStatic(){
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox','0 0 14 14'); svg.classList.add('tick');
    const p1=document.createElementNS(svgNS,'path'); p1.setAttribute('d','M3 7 L6 10');
    const p2=document.createElementNS(svgNS,'path'); p2.setAttribute('d','M6 10 L11 3');
    svg.appendChild(p1); svg.appendChild(p2); return svg;
  }

  /* Метрики шрифта для точного Y зачёркивания (по кириллице) */
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

  function syncEmptyClass(el){
    if((el.textContent||'').trim()==='') el.classList.add('empty'); else el.classList.remove('empty');
  }

  /* Перечёркивание: строим линии по каждой визуальной строке */
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
        const xHeight  = metrics.ascent; // приближение
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

  /* Рендер */
  function render(){
    list.innerHTML='';

    for(let i=0;i<tasks.length;i++){
      const t=tasks[i];
      const li=document.createElement('li'); if(t.done) li.classList.add('done');

      const circle=document.createElement('div'); circle.className='circle';
      if(t.done){ circle.appendChild(makeTickSVGStatic()); }

      circle.addEventListener('pointerdown', ()=> circle.classList.add('touch'));
      circle.addEventListener('pointerup',   ()=> circle.classList.remove('touch'));
      circle.addEventListener('pointercancel',()=> circle.classList.remove('touch'));
      circle.addEventListener('pointerleave', ()=> circle.classList.remove('touch'));

      const textWrap=document.createElement('div'); textWrap.className='textwrap';
      const text=document.createElement('div');
      text.className='task-text'; text.contentEditable='true'; text.spellcheck=false;
      text.dataset.placeholder='Новая задача…'; text.textContent=t.text||'';
      syncEmptyClass(text);

      textWrap.appendChild(text);
      li.appendChild(circle);
      li.appendChild(textWrap);
      list.appendChild(li);

      circle.addEventListener('click', ()=>{
        if((text.textContent||'').trim()==='') return;
        t.done=!t.done; save();
        if(t.done){
          li.classList.add('done');
          const old=circle.querySelector('svg.tick'); if(old) old.remove();
          circle.appendChild(makeTickSVGStatic());
          buildStrike(textWrap, true);
        }else{
          li.classList.remove('done');
          const old=circle.querySelector('svg.tick'); if(old) old.remove();
          const s=textWrap.querySelector('.strike-svg'); if(s) s.remove();
        }
      });

      text.addEventListener('input', ()=>{
        tasks[i].text=text.textContent; save(); syncEmptyClass(text);
        if(t.done) buildStrike(textWrap, false);
      });

      // Удаление пустой строки Backspace/Delete — разрешено для любой строки
      text.addEventListener('keydown',(e)=>{
        const val=(text.textContent||'').trim();
        if((e.key==='Backspace'||e.key==='Delete') && val===''){
          e.preventDefault();
          const goPrev=(e.key==='Backspace');
          const nextIndex=goPrev?Math.max(0, i-1):Math.min(tasks.length-1, i+1);
          tasks.splice(i,1); save(); render();
          const targetLi=list.children[Math.min(nextIndex, list.children.length-2)];
          if(targetLi){
            const ti=targetLi.querySelector('.task-text');
            if(ti){ ti.focus(); /* без скролла */ }
          }
        }
      });

      if(t.done) buildStrike(textWrap, false);
    }

    const spacer=document.createElement('li'); spacer.className='scroll-spacer'; spacer.setAttribute('aria-hidden','true'); list.appendChild(spacer);
  }

  /* ДОБАВЛЕНИЕ НОВОЙ ЗАДАЧИ — вообще без программного скролла */
  function addTask(){
    tasks.push({text:'',done:false}); save(); render();

    const lastLi=list.querySelector('li:nth-last-child(2)'); // последняя реальная
    if(lastLi){
      const c = lastLi.querySelector('.circle');
      const tx = lastLi.querySelector('.task-text');

      if(c){ c.classList.add('born'); setTimeout(()=>c.classList.remove('born'), 800); }
      if(tx){
        tx.focus();
        // мягкое появление плейсхолдера у только что добавленной пустой строки
        tx.classList.add('empty');
        tx.classList.add('ph-anim-start');
        requestAnimationFrame(()=>{
          tx.classList.add('ph-appear');
          setTimeout(()=> tx.classList.remove('ph-anim-start','ph-appear'), 260);
        });
      }
      /* НИКАКОГО scrollTo/scrollIntoView */
    }
  }

  // классы для ручного запуска анимации плейсхолдера (добавляются в addTask)
  // (CSS берёт переходы из .task-text::before и .task-text.empty::before)

  addBtn.addEventListener('pointerdown', ()=> addBtn.classList.add('pressed'));
  addBtn.addEventListener('pointerup',   ()=> addBtn.classList.remove('pressed'));
  addBtn.addEventListener('pointercancel',()=> addBtn.classList.remove('pressed'));
  addBtn.addEventListener('pointerleave', ()=> addBtn.classList.remove('pressed'));
  addBtn.addEventListener('click', addTask);

  render();

  // автофокус на первую пустую — без скролла
  (function(){
    const first=Array.from(document.querySelectorAll('.task-text')).find(n=>(n.textContent||'').trim()==='');
    if(first){ first.focus(); /* не скроллим */ }
  })();

  // пересчитать зачёркивание при ресайзе
  window.addEventListener('resize', ()=>{
    document.querySelectorAll('li').forEach(li=>{
      if(li.classList.contains('done')){
        const wrap=li.querySelector('.textwrap'); if(wrap) buildStrike(wrap,false);
      }
    });
  });