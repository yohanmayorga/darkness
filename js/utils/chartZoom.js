/**
 * Utilidad compartida para zoom en gráficas con rueda del mouse y pellizco táctil (pinch-to-zoom).
 */

export function formatZoomLabel(zoom) {
  return `${Number(Number(zoom).toFixed(2))}x`;
}

function snapZoom(value, minZoom, maxZoom, step) {
  const clamped = Math.min(maxZoom, Math.max(minZoom, value));
  return Number((Math.round(clamped / step) * step).toFixed(2));
}

export function attachChartZoom(scrollEl, {
  getZoom,
  setZoom,
  minZoom = 1,
  maxZoom = 6,
  step = 0.25,
  onZoomChange
}) {
  if (!scrollEl || scrollEl.dataset.zoomBound === '1') return;
  scrollEl.dataset.zoomBound = '1';

  const applyZoom = (targetZoom, clientX) => {
    const prevZoom = getZoom();
    const nextZoom = snapZoom(targetZoom, minZoom, maxZoom, step);
    if (nextZoom === prevZoom) return;

    const rect = scrollEl.getBoundingClientRect();
    const localX = typeof clientX === 'number' ? (clientX - rect.left) : (rect.width / 2);
    const totalW = Math.max(1, scrollEl.scrollWidth);
    const ratio = (scrollEl.scrollLeft + localX) / totalW;

    setZoom(nextZoom);

    const restoreScroll = (targetEl = scrollEl) => {
      if (!targetEl) return;
      const newTotalW = Math.max(1, targetEl.scrollWidth);
      targetEl.scrollLeft = Math.max(0, ratio * newTotalW - localX);
    };

    onZoomChange(nextZoom, restoreScroll);
  };

  // Zoom con rueda del mouse (y Ctrl+rueda en trackpads)
  scrollEl.addEventListener('wheel', (e) => {
    if (e.deltaY === 0) return;
    if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? step : -step;
    applyZoom(getZoom() + delta, e.clientX);
  }, { passive: false });

  // Zoom con dos dedos en pantalla táctil (pinch-to-zoom)
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  const touchDist = (touches) => Math.hypot(
    touches[1].clientX - touches[0].clientX,
    touches[1].clientY - touches[0].clientY
  );

  const touchCenterX = (touches) => (touches[0].clientX + touches[1].clientX) / 2;

  scrollEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchStartDist = touchDist(e.touches);
      pinchStartZoom = getZoom();
    }
  }, { passive: true });

  scrollEl.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || pinchStartDist <= 0) return;
    e.preventDefault();
    const dist = touchDist(e.touches);
    const next = pinchStartZoom * (dist / pinchStartDist);
    applyZoom(next, touchCenterX(e.touches));
  }, { passive: false });

  scrollEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      pinchStartDist = 0;
    }
  }, { passive: true });
}
