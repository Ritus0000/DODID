/* ============================================================================
  script.js — единый скрипт приложения
  Что внутри (без изменения поведения и эффектов):
    1) День недели вверху (#dayHeader)
    2) Состояние задач + localStorage + перенос «на новый день»
    3) Рендер из массива tasks[] (DOM всегда = данным)
       — выполненные уходят вниз; порядок внутри групп стабильный
       — contenteditable; зачёркивание по реальным глиф-боксам (SVG)
    4) Тихая подсветка скроллбара при прокрутке
    5) iOS-фиксы:
       — запрет «резиновой прокрутки» вне #tasks (шапки не «ездят»)
       — подъём нижнего дока при клавиатуре (VisualViewport)
============================================================================ */

/* ---------- 1) День недели в шапке ---------- */
const RU_DAYS = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
function setDayHeader(d = new Date()){
  const el = document.getElementById("dayHeader");
  if (el) el.textContent = RU_DAYS[d.getDay()];
}
setDayHeader();
setInterval(setDayHeader, 60_000);

/* ---------- 2) Состояние/хранение задач ---------- */
const KEY_TASKS = "dodid_tasks_v1";   // массив [{text, done}]
const KEY_LAST  = "dodid_lastDate";   // строка Date.toDateString для «ролловера»
const START_TASKS = 3;                // минимум пустых слотов на новый день
const todayKey = (d = new Date()) => d.toDateString();

let tasks = [];
try { tasks = JSON.parse(localStorage.getItem(KEY_TASKS) || "[]") || []; }
catch { tasks = []; }
if (!tasks.length) {
  tasks = Array.from({ length: START_TASKS }, () => ({ text: "", done: false }));
}

function save(){
  localStorage.setItem(KEY_TASKS, JSON.stringify(tasks));
  localStorage.setItem(KEY_LAST, todayKey());
}

/* Перенос «на новый день»: оставляем только невыполненные, добиваем пустыми */
function rolloverIfNeeded(){
  const last = localStorage.getItem(KEY_LAST);
  const today = todayKey();
  if (last === today) return;

  const carried = tasks.filter(t => !t.done).map(t => ({ text: t.text, done: false }));
  const need = Math.max(0, START_TASKS - carried.length);
  const padding = Array.from({ length: need }, () => ({ text: "", done: false }));

  tasks = [...carried, ...padding];
  save();
  render();
}
rolloverIfNeeded();
setInterval(rolloverIfNeeded, 60_000);

/* ---------- 3) Рендер: DOM ← tasks[] ---------- */
const listEl   = document.getElementById("tasks");
const addBtnEl = document.getElementById("addBtn");

/* Показать тонкий скроллбар только во время прокрутки (класс .scrolling) */
let _scrollHideTimer = null;
if (listEl){
  listEl.addEventListener("scroll", () => {
    listEl.classList.add("scrolling");
    clearTimeout(_scrollHideTimer);
    _scrollHideTimer = setTimeout(() => listEl.classList.remove("scrolling"), 800);
  }, { passive: true });
}

/* === Зачёркивание по real glyph boxes через SVG поверх текста ================= */
const _fontCache = new Map();
/** Метрики шрифта для элемента (ascent/descent; x-height ≈ метрика «x») */
function getFontMetrics(el){
  const cs = getComputedStyle(el);
  const font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
  if (_fontCache.has(font)) return _fontCache.get(font);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  try { ctx.font = font; } catch {}
  const m = ctx.measureText("x");
  const ascent  = m.actualBoundingBoxAscent  || parseFloat(cs.fontSize) * 0.8;
  const descent = m.actualBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
  const out = { a: ascent, d: descent, h: ascent + descent };
  _fontCache.set(font, out);
  return out;
}
/** Пустой текст помечаем классом .empty (серый тон) */
function syncEmpty(el){
  (el.textContent || "").trim() === "" ? el.classList.add("empty")
                                       : el.classList.remove("empty");
}
/** Построить/снять линии зачёркивания поверх строки */
function buildStrike(rowEl, active){
  const textEl = rowEl.querySelector(".text");
  let svg = rowEl.querySelector("svg.strike");

  if (!active){
    if (svg) svg.remove();
    return;
  }
  const parent = textEl.getBoundingClientRect();

  if (!svg){
    svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.classList.add("strike");
    svg.style.position = "absolute";
    svg.style.left = "0"; svg.style.top = "0";
    svg.style.width = "100%"; svg.style.height = "100%";
    rowEl.appendChild(svg); // слой поверх текста
  }
  svg.innerHTML = "";

  // Реальные прямоугольники глифов текста
  const range = document.createRange();
  range.selectNodeContents(textEl);
  const rects = Array.from(range.getClientRects());

  const fm = getFontMetrics(textEl);

  rects.forEach(r => {
    const x1 = r.left  - parent.left;
    const x2 = r.right - parent.left;
    const len = Math.max(0, x2 - x1);
    if (len <= 0) return;

    // baseline = нижняя грань - descent; линия на половине x-height
    const baseline = (r.bottom - parent.top) - fm.d;
    const y = baseline - (fm.a / 2);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1.toFixed(1));
    line.setAttribute("y1", y.toFixed(1));
    line.setAttribute("x2", x2.toFixed(1));
    line.setAttribute("y2", y.toFixed(1));
    line.classList.add("strike-line");
    svg.appendChild(line);
  });
}

/* Создание одного <li> */
function createRow(task){
  const li = document.createElement("li");
  li.style.position = "relative";

  // Левая иконка: кольцо + галочка (SVG → чёткая анимация штриха)
  const tick = document.createElementNS("http://www.w3.org/2000/svg","svg");
  tick.setAttribute("viewBox", "0 0 14 14");
  tick.setAttribute("aria-hidden", "true");
  tick.classList.add("tick");
  const ring = document.createElementNS(tick.namespaceURI, "path");
  ring.setAttribute("d","M7,1 A6,6 0 1,1 7,13 A6,6 0 1,1 7,1 Z");
  ring.classList.add("tick-ring");
  const mark = document.createElementNS(tick.namespaceURI, "path");
  mark.setAttribute("d","M4 7 L6 9 L10 5");
  mark.classList.add("tick-mark");
  tick.append(ring, mark);

  // Текст задачи — редактируем прямо в строке
  const text = document.createElement("span");
  text.className = "text";
  text.contentEditable = "true";
  text.spellcheck = false;
  text.textContent = task.text || "";
  syncEmpty(text);

  if (task.done) li.classList.add("done");
  li.append(tick, text);

  // Клик по кружку: переключаем done → сохраняем → полный ререндер
  tick.addEventListener("click", (e) => {
    e.stopPropagation();
    task.done = !task.done;
    save();
    render(); // утапливает «done» вниз и пересобирает strike
  });

  // Редактирование текста с немедленным сохранением
  text.addEventListener("input", () => {
    task.text = text.textContent;
    syncEmpty(text);
    save();
  });
  text.addEventListener("blur", () => {
    const v = (text.textContent || "").trim();
    if (v !== text.textContent) text.textContent = v;
    task.text = v;
    syncEmpty(text);
    save();
  });

  // Построим/снимем зачёркивание сейчас
  buildStrike(li, task.done);
  return li;
}

/* Полный рендер списка: сначала активные, потом выполненные */
function render(){
  if (!listEl) return;
  listEl.innerHTML = "";

  const active = [], completed = [];
  tasks.forEach(t => (t.done ? completed : active).push(t));

  [...active, ...completed].forEach(t => listEl.appendChild(createRow(t)));
}
render();

/* Добавление новой пустой задачи кнопкой «плюс» */
if (addBtnEl){
  addBtnEl.addEventListener("click", () => {
    tasks.push({ text: "", done: false });
    save();
    render();

    // Сразу фокус в свежую строку, курсор в конец
    const last = listEl.querySelector("li:last-child .text");
    if (last) {
      last.focus();
      const sel = getSelection();
      const range = document.createRange();
      range.selectNodeContents(last);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
}

/* Пересборка линий при изменении вьюпорта (ориентация/клавиатура) */
let _resizeRaf = 0;
function reflowStrikes(){
  if (!listEl) return;
  cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(() => {
    listEl.querySelectorAll("li").forEach(li => {
      buildStrike(li, li.classList.contains("done"));
    });
  });
}
window.addEventListener("resize", reflowStrikes);

/* ---------- 4) iOS-фиксы (в этом же файле) ---------- */

/* (A) Запрет «rubber-band» вне #tasks: шапки стоят как вкопанные */
(function lockIOSRubberBand(){
  const scrollArea = document.getElementById("tasks");
  if (!scrollArea) return;

  document.addEventListener("touchmove", (e) => {
    // Разрешаем только внутри списка задач
    if (!scrollArea.contains(e.target)) e.preventDefault();
  }, { passive: false });

  // На саму область скролла вешаем non-passive слушатели — iOS не ругается
  ["touchstart","touchmove","touchend","touchcancel"].forEach(ev => {
    scrollArea.addEventListener(ev, () => {}, { passive: false });
  });
})();

/* (B) Поднятие нижнего дока при появлении экранной клавиатуры */
(function bridgeKeyboard(){
  const vv = window.visualViewport;
  const dock = document.getElementById("dock");
  if (!vv || !dock) return;

  function apply(){
    // «Вытесненная» высота = клавиатура + системные панели
    const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    // Пишем в CSS-переменную (если нужно учесть в верстке)…
    document.documentElement.style.setProperty("--kb", hidden + "px");
    // …и сразу сдвигаем док (мгновенная реакция)
    dock.style.transform = hidden > 0 ? `translateY(-${hidden}px)` : "";
  }
  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply); // offsetTop тоже меняется
  apply();
})();
