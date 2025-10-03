/* ===== День недели (динамически) ===== */
const ruDays = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
// Массив локализованных названий дней недели. Индекс соответствует Date.getDay() (0 = воскресенье).

function setDayHeader(d=new Date()){
  // d=new Date() — параметр по умолчанию: текущая дата, если не передана вручную.
  document.getElementById("dayHeader").textContent = ruDays[d.getDay()];
  // Находим элемент с id="dayHeader" и записываем туда строку из ruDays по индексу дня (0..6).
}
setDayHeader();                     // Мгновенное обновление при загрузке.
setInterval(setDayHeader, 60_000);  // Периодическое обновление раз в минуту (подчёркивание 60_000 = 60000).

/* ===== Локальное хранилище + перенос на новый день ===== */
const KEY_TASKS='dodid_tasks_v1'; // Ключ в localStorage для массива задач.
const KEY_LAST ='dodid_lastDate'; // Ключ с датой последнего открытия (строка из toDateString()).
const START_TASKS=3;              // При пустом состоянии создаём N пустых задач-слотов.

let tasks=[]; // Глобальный массив задач в формате { text: string, done: boolean }.
try{
  // Пытаемся прочитать JSON из localStorage. Если пусто — '[]'. JSON.parse может бросить исключение.
  tasks=JSON.parse(localStorage.getItem(KEY_TASKS)||'[]')||[]
}catch{
  // Если данные повреждены либо не парсятся — сбрасываем в пустой массив.
  tasks=[]
}
if(!tasks.length){
  // Если задач нет — создаём стартовые пустые слоты (визуально удобно сразу видеть поля ввода).
  tasks = Array.from({length:START_TASKS},()=>({text:'',done:false}))
}

function save(){
  // Сериализуем и пишем массив задач обратно в localStorage под KEY_TASKS.
  localStorage.setItem(KEY_TASKS, JSON.stringify(tasks));
}
function todayKey(d=new Date()){
  // Унифицированное представление «сегодня» — Date.toDateString() (зависит от локали, но стабильно в рамках устройства).
  return d.toDateString();
}

function rolloverIfNeeded(){
  // Перенос незавершённых задач на новый день.
  const today=todayKey();                 // Текущая дата как строка.
  const last=localStorage.getItem(KEY_LAST); // Последняя дата запуска/перерисовки.
  if(last===today) return;                // Если тот же день — ничего не делаем.

  // Фильтруем все невыполненные задачи с непустым текстом, переносим их в новый массив, сбрасывая done=false.
  const carried = tasks
    .filter(t=>!t.done && (t.text||'').trim()!=='')
    .map(t=>({text:t.text,done:false}));

  // Если что переносить — переносим + добавляем пустой слот; иначе — создаём стартовые слоты.
  tasks = carried.length
    ? [...carried,{text:'',done:false}]
    : Array.from({length:START_TASKS},()=>({text:'',done:false}));

  save();                                // Сохраняем новое состояние.
  localStorage.setItem(KEY_LAST, today); // Обновляем «последнюю дату» на сегодня.
  render();                              // Перерисовываем список.
}
rolloverIfNeeded();                       // Проверка сразу при загрузке.
setInterval(rolloverIfNeeded, 60_000);    // И раз в минуту — на случай долгого открытого экрана.

/* ===== DOM ===== */
const list = document.getElementById('tasks'); // <ul id="tasks"> — контейнер для <li>.
const addBtn = document.getElementById('addBtn'); // Кнопка «+».

/* Показ тонкой полоски только во время скролла */
// Идея: при скролле добавляем класс .scrolling, который окрашивает тонкий скролл-бар,
// затем по таймеру 800ms убираем — эффект «появляется только во время движения».
let hideTimer=null;
list.addEventListener('scroll', ()=>{
  list.classList.add('scrolling');             // Активируем стиль для ::-webkit-scrollbar-thumb.
  clearTimeout(hideTimer);                     // Если прошлый таймер ещё шёл — сбрасываем.
  hideTimer=setTimeout(()=>list.classList.remove('scrolling'), 800);
}, {passive:true}); // passive:true — говорит браузеру, что обработчик не вызывает preventDefault().

/* ===== Помощники ===== */
function syncEmpty(el){
  // Управляет плейсхолдером через класс .empty (см. CSS ::before с «Новая задача…»).
  (el.textContent||'').trim()==='' ? el.classList.add('empty') : el.classList.remove('empty');
}

function makeTick(){
  // Программно рисуем «галочку» внутри кружка (SVG 14x14, две линии).
  const s='http://www.w3.org/2000/svg', svg=document.createElementNS(s,'svg');
  svg.setAttribute('viewBox','0 0 14 14'); svg.classList.add('tick');
  const p1=document.createElementNS(s,'path'); p1.setAttribute('d','M3 7 L6 10');   // Нога 1
  const p2=document.createElementNS(s,'path'); p2.setAttribute('d','M6 10 L11 3');  // Нога 2
  svg.appendChild(p1); svg.appendChild(p2); return svg;
}

let fontMetricsCache=null; // Кэш метрик шрифта (чтобы не мерить каждый раз).

function computeFontMetricsFor(el){
  // Получаем вычисленные стили, собираем CSS-шрифт в строку канваса и измеряем метрики текста.
  const cs=getComputedStyle(el);
  const style=cs.fontStyle||'normal';
  const weight=cs.fontWeight||'400';
  const size=cs.fontSize||'18px';
  const line=cs.lineHeight && cs.lineHeight!=='normal'? cs.lineHeight:size;
  const family=cs.fontFamily || 'Helvetica Neue, Arial, sans-serif';
  const font=`${style} ${weight} ${size}/${line} ${family}`; // Формат canvas 2D: "<style> <weight> <size>/<line> <family>"

  const c=document.createElement('canvas'), ctx=c.getContext('2d');
  ctx.font=font; // Важно: назначить шрифт ДО measureText.
  // Используем кириллическую строку с разными высотами штрихов для реалистичнейшего x-height.
  const m=ctx.measureText('кенгшзхываполжэячсмитью');
  const a=m.actualBoundingBoxAscent||0, d=m.actualBoundingBoxDescent||0;
  // Возвращаем объект только если есть валидные метрики. Иначе — null (fallback в buildStrike).
  return (a||d)? {a,d}:null;
}

function getFontMetrics(el){
  // Ленивый кэш: мерим один раз; при смене шрифта/размера перезагрузкой страницы обновится.
  if(!fontMetricsCache) fontMetricsCache=computeFontMetricsFor(el);
  return fontMetricsCache;
}

function buildStrike(textWrap, animate=true){
  // Генерация SVG-зачёркивания поверх фактических строк текста (многострочный split по реальным линиям).
  const old=textWrap.querySelector('.strike-svg'); if(old) old.remove(); // Удаляем предыдущий SVG, если был.

  const textEl=textWrap.querySelector('.task-text'); if(!textEl) return; // Страховка: нет текста — выходим.
  syncEmpty(textEl); // Обновляем состояние плейсхолдера.

  // Range по содержимому: получаем прямоугольники (ClientRects) отдельных визуальных линий.
  const range=document.createRange(); range.selectNodeContents(textEl);
  const rects=Array.from(range.getClientRects());

  // Создаём SVG поверх .textwrap с абсолютным позиционированием (см. CSS .strike-svg { position:absolute; inset:0; }).
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg'); svg.classList.add('strike-svg');

  // Размер SVG = размер контейнера .textwrap (чтобы координаты совпадали с прямоугольниками текста).
  const parent=textWrap.getBoundingClientRect();
  svg.setAttribute('width',parent.width); svg.setAttribute('height',parent.height);
  svg.setAttribute('viewBox',`0 0 ${parent.width} ${parent.height}`);

  // Пытаемся аккуратно попасть в середину x-height: baseline - (ascent/2). Если метрик нет — fallback по 0.56*h.
  const fm=getFontMetrics(textEl); const ratio=0.56;

  rects.forEach(r=>{
    // Координаты прямоугольника строки относительно .textwrap
    const x1=r.left-parent.left, x2=r.right-parent.left, len=Math.max(0,x2-x1);
    if(len<=0) return;

    let y;
    if(fm){
      // baseline = нижняя граница строки (r.bottom) минус десцент (fm.d)
      const baseline=(r.bottom-parent.top)-fm.d;
      const xh=fm.a; // высота над базовой линией (ascent)
      y=baseline-(xh/2); // серединка x-height (условно). Визуально даёт ровное зачёркивание.
    }else{
      // Fallback: 56% от высоты прямоугольника
      y=(r.top-parent.top)+r.height*ratio;
    }

    // Линия <line> длиной равной ширине текстовой строки (stroke рисуется текущим цветом текста).
    const line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y);
    line.setAttribute('x2',x2); line.setAttribute('y2',y);
    line.classList.add('strike-line');
    line.style.setProperty('--len', `${len}`); // CSS-переменная длины для анимации штриха.

    if(!animate){
      // Для мгновенного состояния (при initial render) выключаем анимацию.
      line.style.strokeDashoffset=0; line.style.transition='none';
    }
    svg.appendChild(line);

    if(animate){
      // Запускаем анимацию в следующем кадре: dashoffset -> 0 (см. CSS transition).
      requestAnimationFrame(()=>{ line.style.strokeDashoffset=0; });
    }
  });

  textWrap.appendChild(svg); // Вставляем SVG внутрь .textwrap (поверх текста).
}

/* Фокус в конец, чтобы поднять клавиатуру и сразу печатать */
function placeCaretAtEnd(el){
  // Создаём Range на весь контент и коллапсируем в конец: курсор в конец строки.
  const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function focusEditable(el){
  // Через requestAnimationFrame — гарантируем, что DOM готов и элемент в документе.
  // el.focus({preventScroll:true}) — предотвращает автопрокрутку, оставляя наш собственный layout.
  // el.click() — на iOS помогает показать caret в contentEditable.
  requestAnimationFrame(()=>{
    el.focus({preventScroll:true});
    placeCaretAtEnd(el);
    try{ el.click(); }catch{} // без ошибок, если событие запрещено браузером.
  });
}

/* ===== Рендер ===== */
function render(){
  // Полная перерисовка списка UL из массива tasks. Сначала очищаем.
  list.innerHTML='';

  tasks.forEach((t,i)=>{
    // Создаём <li> и, если задача выполнена, ставим класс .done (влияет на цвет и зачёркивание).
    const li=document.createElement('li'); if(t.done) li.classList.add('done');

    // Левая часть — круг для отметки выполненности.
    const circle=document.createElement('div'); circle.className='circle';
    if(t.done) circle.appendChild(makeTick()); // Если done=true — рисуем галочку.
    // Небольшие эффекты нажатия для тактильности.
    circle.addEventListener('pointerdown',()=>circle.classList.add('touch'));
    circle.addEventListener('pointerup',()=>circle.classList.remove('touch'));
    circle.addEventListener('pointercancel',()=>circle.classList.remove('touch'));
    circle.addEventListener('pointerleave',()=>circle.classList.remove('touch'));

    // Правая часть — контейнер текста + слой SVG для зачёркивания.
    const wrap=document.createElement('div'); wrap.className='textwrap';
    const text=document.createElement('div');
    text.className='task-text';           // Стили шрифта наследуются от li/body.
    text.contentEditable='true';          // Редактируемый блок — как поле ввода без рамок.
    text.spellcheck=false;                // Отключаем подсказки орфографии.
    text.textContent=t.text||'';          // Значение текста из модели.
    syncEmpty(text);                      // Проставляем/убираем плейсхолдер.

    // Сборка и вставка в DOM:
    wrap.appendChild(text);
    li.appendChild(circle); li.appendChild(wrap); list.appendChild(li);

    // Клик по кружку — переключение done (если строка не пуста).
    circle.addEventListener('click',()=>{
      if((text.textContent||'').trim()==='') return; // Пустые строки не отмечаем выполненными.
      t.done=!t.done; save();                         // Инвертируем флаг и сохраняем.

      if(t.done){
        // Визуально отмечаем: класс .done, перерисовываем галочку и строим зачёркивание.
        li.classList.add('done'); circle.innerHTML=''; circle.appendChild(makeTick());
        buildStrike(wrap,true);
      } else {
        // Снимаем отметку: убираем SVG и галочку.
        li.classList.remove('done'); circle.innerHTML='';
        const s=wrap.querySelector('.strike-svg'); if(s) s.remove();
      }
    });

    // Ввод текста: синхронизируем модель, сохраняем, поддерживаем зачёркивание для done-строк.
    text.addEventListener('input',()=>{
      tasks[i].text=text.textContent; save(); syncEmpty(text);
      if(t.done) buildStrike(wrap,false); // При редактировании выполненной — перестраиваем линии без анимации.
    });

    // Управление Backspace/Delete на пустой строке: удаляем задачу вместо «ничего».
    text.addEventListener('keydown',(e)=>{
      const val=(text.textContent||'').trim();
      if((e.key==='Backspace'||e.key==='Delete') && val===''){
        e.preventDefault(); // Блокируем стандартное удаление символов (их нет).
        tasks.splice(i,1);  // Удаляем задачу из массива.
        if(tasks.length===0) tasks.push({text:'',done:false}); // Никогда не оставляем пустой список.
        save(); render();   // Сохраняем и перерисовываем весь список.
      }
    });

    // Если задача уже выполнена при рендере — сразу рисуем зачёркивание (без анимации).
    if(t.done) buildStrike(wrap,false);
  });
}

/* ===== Добавление задачи: + рождает кружок, клавиатура сразу ===== */
function addTask(){
  tasks.push({text:'',done:false}); save(); render(); // Добавляем пустую задачу, сохраняем, перерисовываем.

  const last=list.querySelector('li:last-child'); // Получаем последний <li>.
  if(last){
    const c=last.querySelector('.circle'); // Чтобы анимировать «рождение» кружка.
    const tx=last.querySelector('.task-text'); // Чтобы сразу поставить фокус и поднять клавиатуру.
    if(c){ c.classList.add('born'); setTimeout(()=>c.classList.remove('born'), 750); } // Анимация появления.
    if(tx){ tx.classList.add('empty'); focusEditable(tx); } // Фокус и плейсхолдер.
  }
}
const addBtnEl=document.getElementById('addBtn');
addBtnEl.addEventListener('pointerdown',()=>addBtnEl.classList.add('pressed'));   // Визуальный отклик на «вжал».
addBtnEl.addEventListener('pointerup',()=>addBtnEl.classList.remove('pressed'));  // Отпустил — вернуть тень/масштаб.
addBtnEl.addEventListener('pointercancel',()=>addBtnEl.classList.remove('pressed'));
addBtnEl.addEventListener('pointerleave',()=>addBtnEl.classList.remove('pressed'));
addBtnEl.addEventListener('click', addTask); // Основное действие: создать новую задачу.

/* Клик вне поля — убрать фокус */
// Если нажали в любом месте, не являющемся .task-text, снимаем фокус с активного поля (закрывает клавиатуру на iOS).
document.addEventListener('pointerdown',(e)=>{
  if(!e.target.closest('.task-text')){
    const a=document.activeElement; if(a && a.blur) a.blur();
  }
},{passive:true});

/* Первичный рендер */
render();

/* Пересчитать зачёркивание при ресайзе */
// При изменении размера вьюпорта (ориентация/клавиатура/динамическая ширина)
// проходим по всем .done элементам и пересобираем SVG-линии по новым прямоугольникам.
window.addEventListener('resize', ()=>{
  document.querySelectorAll('#tasks li.done .textwrap').forEach(w=>buildStrike(w,false));
});

/* ==== Анти-bounce для iOS (чтоб шапка не «ездила») ==== */
(function lockIOSRubberBand(){
  // Смысл: отключить «резиновую» прокрутку, при которой тянется вся страница.
  const scroller = document.getElementById('tasks');
  if (!scroller) return;

  // Если тянем пальцем НЕ по списку — запрещаем вертикальный скролл документа.
  document.addEventListener('touchmove', (e)=>{
    if (!e.target.closest('#tasks')) e.preventDefault();
  }, { passive: false });

  // При старте касания слегка отодвигаем scrollTop от краёв (0 и max), чтобы iOS не «тянула» родителя.
  scroller.addEventListener('touchstart', ()=>{
    const max = scroller.scrollHeight - scroller.clientHeight;
    if (max <= 0) return;                 // Нечего скроллить — ничего не делаем.
    if (scroller.scrollTop <= 0) scroller.scrollTop = 1;
    else if (scroller.scrollTop >= max) scroller.scrollTop = max - 1;
  }, { passive: true });

  // Если контента мало (scrollHeight <= clientHeight) — полностью блокируем «пружину» внутри списка.
  scroller.addEventListener('touchmove', (e)=>{
    if (scroller.scrollHeight <= scroller.clientHeight) e.preventDefault();
  }, { passive: false });
})();

/* ===== Мягкая отправка выполненных задач вниз (DOM-переупорядочивание) =====
   ВАЖНО: это чисто визуальная сортировка элементов в DOM и не меняет порядок в массиве tasks.
   То есть после перерисовки (render()) исходный порядок восстановится.
   Если захочешь закрепить порядок — перенесём логику в модель и save().
*/
function toggleTask(li) {
  // Переключает класс .done у конкретного <li> и запускает перестановку.
  li.classList.toggle("done");
  reorderTasks();
}

function reorderTasks() {
  const tasks = document.querySelector("#tasks"); // Переменная перекрывает внешнее 'list' только в пределах функции.
  const items = Array.from(tasks.children);       // Список текущих <li> в DOM.

  // Разделяем на активные и выполненные по наличию класса .done
  const active = items.filter(li => !li.classList.contains("done"));
  const completed = items.filter(li => li.classList.contains("done"));

  // Добавляем обратно в UL: сначала активные, затем выполненные.
  // Перемещение узла в тот же родитель — это переупорядочивание без перерисовки содержимого <li>.
  [...active, ...completed].forEach(li => tasks.appendChild(li));
}
