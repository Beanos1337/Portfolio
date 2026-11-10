// Night Tide · ASCII code art by JIN2 (@jin_22ee), 2026. Credited in the page footer.
// Starts the sea behind the loading screen; the drawing itself runs in night-tide.worker.js.
(() => {
  const loader = document.querySelector('.loader');
  if (!loader || getComputedStyle(loader).display === 'none') return; // reduced motion: no loader, nothing to draw
  const art = loader.querySelector('.tide-art'), glow = loader.querySelector('.tide-glow');
  // shortcut: browsers without OffscreenCanvas get the plain dark loader; add a main-thread fallback if that matters
  if (!art.transferControlToOffscreen || !window.Worker) return;
  const worker = new Worker('assets/js/night-tide.worker.js');
  const a = art.transferControlToOffscreen(), g = glow.transferControlToOffscreen();
  const size = () => ({ w: loader.clientWidth, h: loader.clientHeight });
  worker.postMessage({ art: a, glow: g, ...size() }, [a, g]);
  addEventListener('resize', () => worker.postMessage(size()));
  // main.js hides the loader once the curtain has lifted: stop the sea then
  new MutationObserver((_, mo) => {
    if (loader.style.display === 'none') { worker.terminate(); mo.disconnect(); }
  }).observe(loader, { attributes: true, attributeFilter: ['style'] });
})();
