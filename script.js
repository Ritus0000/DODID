/* ============================================================================
  script (2).js — iOS bridge
  Назначение: строгая фиксация экрана (убираем "rubber-band" эффект),
  и корректное поднятие нижнего дока при появлении экранной клавиатуры
  через VisualViewport API (iOS Safari).
  Внешние элементы:
    - #tasks — единственная область, где разрешён скролл
    - #dock  — нижняя панель, которую нужно поднимать при клавиатуре
============================================================================ */

/* ---------- Блокировка резиновой прокрутки вне #tasks ----------
   Идея: на документ навешиваем touchmove с preventDefault,
   НО если событие произошло внутри #tasks — разрешаем (для списка).
   Важно: { passive:false }, иначе preventDefault не сработает.
---------------------------------------------------------------------------- */
(function lockIOSRubberBand(){
  const scrollArea = document.getElementById("tasks");
  if (!scrollArea) return;

  document.addEventListener("touchmove", (e) => {
    // Разрешаем только внутри списка
    if (!scrollArea.contains(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  // На саму область скролла вешаем события с passive:false
  // Это «фиксирует» политику слушателей и предотвращает ругань iOS.
  ["touchstart","touchmove","touchend","touchcancel"].forEach(ev => {
    scrollArea.addEventListener(ev, () => {}, { passive: false });
  });
})();

/* ---------- Поднятие дока при клавиатуре (VisualViewport) ----------
   Формула из практики iOS:
     hidden = window.innerHeight - vv.height - vv.offsetTop
   Это «вытесненная» высота, равная размеру клавиатуры + системных панелей.
   Мы записываем её в CSS-переменную --kb и одновременно сдвигаем #dock.
---------------------------------------------------------------------------- */
(function bridgeKeyboard(){
  const vv = window.visualViewport;
  const dock = document.getElementById("dock");
  if (!vv || !dock) return;

  function apply(){
    const hidden = window.innerHeight - vv.height - vv.offsetTop;
    // Пишем значение с единицами в корень документа: можно использовать в CSS
    document.documentElement.style.setProperty("--kb", `${Math.max(0, hidden)}px`);
    // И сразу двигаем док (чтобы не ждать реакцию верстки)
    dock.style.transform = hidden > 0 ? `translateY(-${hidden}px)` : "";
  }

  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply); // при появлении клавиатуры offsetTop тоже меняется
  apply(); // первичная инициализация
})();
