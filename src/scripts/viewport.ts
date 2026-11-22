/*
  Size a window-filling ("immersive") element to the part of the viewport the
  player can actually see. Mobile browsers disagree about 100dvh while the URL
  bar animates, while entering or leaving real fullscreen and after rotating, so
  a fixed element sized that way can hang off the bottom of the screen and hide
  the touch controls. visualViewport is the source of truth; this writes it to
  --vv-top / --vv-h on the element, re-measuring for a few frames after each
  change because some browsers settle late.
*/
export function trackVisibleViewport(el: HTMLElement): () => void {
  let raf = 0;
  let frames = 0;
  const measure = () => {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    el.style.setProperty('--vv-h', `${Math.round(h)}px`);
    el.style.setProperty('--vv-top', `${Math.round(top)}px`);
  };
  const settle = () => {
    measure();
    frames = 0;
    cancelAnimationFrame(raf);
    const tick = () => {
      measure();
      if (++frames < 20) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  const vv = window.visualViewport;
  vv?.addEventListener('resize', settle);
  vv?.addEventListener('scroll', measure);
  window.addEventListener('resize', settle);
  window.addEventListener('orientationchange', settle);
  document.addEventListener('fullscreenchange', settle);
  settle();
  return () => {
    cancelAnimationFrame(raf);
    vv?.removeEventListener('resize', settle);
    vv?.removeEventListener('scroll', measure);
    window.removeEventListener('resize', settle);
    window.removeEventListener('orientationchange', settle);
    document.removeEventListener('fullscreenchange', settle);
    el.style.removeProperty('--vv-h');
    el.style.removeProperty('--vv-top');
  };
}
