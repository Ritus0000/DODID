/* ============================================================================
  script (2).js — iOS bridge
  Goals:
    A) Prevent page "rubber-band" scroll; allow scroll ONLY inside #tasks
    B) Raise #dock when iOS software keyboard appears (VisualViewport)
============================================================================ */

/* A) Lock rubber-band outside #tasks
   - We attach a document-level touchmove listener with preventDefault(),
     but allow touches inside the scrolling area (#tasks).
   - { passive:false } is mandatory so preventDefault actually works on iOS.
*/
(function lockIOSRubberBand(){
  const scrollArea = document.getElementById("tasks");
  if (!scrollArea) return;

  document.addEventListener("touchmove", (e) => {
    if (!scrollArea.contains(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  // Attach non-passive listeners on the scroll area to make iOS happy
  ["touchstart","touchmove","touchend","touchcancel"].forEach(ev => {
    scrollArea.addEventListener(ev, () => {}, { passive: false });
  });
})();

/* B) Raise dock with the iOS keyboard (VisualViewport)
   Formula used:
     hidden = window.innerHeight - vv.height - vv.offsetTop
   That is the "pushed-out" vertical space equal to keyboard height plus UI bars.
   We set CSS var --kb (for layout) and also translate #dock immediately.
*/
(function bridgeKeyboard(){
  const vv = window.visualViewport;
  const dock = document.getElementById("dock");
  if (!vv || !dock) return;

  function apply(){
    const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty("--kb", hidden + "px");
    dock.style.transform = hidden > 0 ? `translateY(-${hidden}px)` : "";
  }

  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply);
  apply();
})();
