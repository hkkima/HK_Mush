// 진입점: 저장/불러오기, 입력(탭·홀드 = 영양제, 드래그 = 수확), 메인 루프
(function () {
  'use strict';
  const MG = window.MG;
  const D = MG.DATA;

  // ── 저장 ─────────────────────────────────────────────────────
  let resetting = false;
  MG.saveGame = function (game) {
    if (resetting) return;
    try { localStorage.setItem(MG.SAVE_KEY, JSON.stringify(game.serialize())); } catch (e) { /* 저장 불가 환경 */ }
  };
  MG.exportSave = function (game) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(game.serialize()))));
  };
  MG.importSave = function (code) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(code))));
      if (!data || typeof data.spores !== 'number') return false;
      resetting = true;
      localStorage.setItem(MG.SAVE_KEY, JSON.stringify(data));
      location.reload();
      return true;
    } catch (e) { return false; }
  };
  MG.hardReset = function () {
    resetting = true;
    try { localStorage.removeItem(MG.SAVE_KEY); } catch (e) { /* noop */ }
    location.reload();
  };

  function loadSaved() {
    try {
      const raw = localStorage.getItem(MG.SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ── 시작 ─────────────────────────────────────────────────────
  const saved = loadSaved();
  const game = new MG.Game(saved);
  const canvas = document.getElementById('field');
  const renderer = new MG.Renderer(canvas, game);
  const ui = new MG.UI(game);
  MG.game = game; // 디버그용

  function welcomeBack(res) {
    if (!res || res.earned <= 0) return;
    ui.modal(`<h3>🍄 다녀오셨어요?</h3><p>${MG.fmtTime(res.secs)} 동안 버섯들이 자랐어요.</p>
      <p>달팽이가 모아둔 포자 <b>✦ ${MG.fmt(res.earned)}</b></p>`);
  }

  if (saved && saved.lastTick) {
    const away = (Date.now() - saved.lastTick) / 1000;
    welcomeBack(game.applyOffline(away));
  }

  // ── 입력 ─────────────────────────────────────────────────────
  let clock = 0;
  let ptr = null;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function sprayAt(p) {
    game.spray(renderer.slotsNear(p.x, p.y, renderer.msize * 1.35));
    renderer.sprayFx(p.x, p.y);
  }

  function slice(ax, ay, bx, by) {
    for (const i of renderer.segmentHits(ax, ay, bx, by)) game.swipeHit(i);
  }

  canvas.addEventListener('pointerdown', e => {
    if (ptr) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    const p = pos(e);
    ptr = { id: e.pointerId, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false, lastSpray: clock };
    renderer.addTrail(p.x, p.y, clock);
    sprayAt(p);
  });

  canvas.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = pos(e);
    if (!ptr.moved) {
      const dx = p.x - ptr.sx, dy = p.y - ptr.sy;
      if (dx * dx + dy * dy > 64) {
        ptr.moved = true;
        game.beginSwipe();
        slice(ptr.sx, ptr.sy, p.x, p.y);
      }
    } else {
      slice(ptr.x, ptr.y, p.x, p.y);
    }
    ptr.x = p.x; ptr.y = p.y;
    renderer.addTrail(p.x, p.y, clock);
  });

  function release(e) {
    if (!ptr || (e && e.pointerId !== ptr.id)) return;
    if (ptr.moved) game.endSwipe();
    ptr = null;
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('resize', () => renderer.resize());

  // ── 루프 ─────────────────────────────────────────────────────
  let lastT = performance.now();
  let panelAcc = 0, saveAcc = 0;

  function frame(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 5) {
      // 탭이 오래 숨겨져 있었음 → 오프라인 진행으로 처리
      const res = game.applyOffline(dt);
      if (dt > 60) welcomeBack(res);
      dt = 0;
    }
    dt = Math.min(dt, 0.1);
    clock += dt;

    if (ptr && !ptr.moved && clock - ptr.lastSpray > 0.17) {
      ptr.lastSpray = clock;
      sprayAt(ptr);
    }

    game.tick(dt);
    for (const e of game.events) { renderer.onEvent(e); ui.onEvent(e); }
    game.events.length = 0;

    renderer.draw(clock, dt);
    ui.updateHud();

    panelAcc += dt;
    if (panelAcc > 0.25) { panelAcc = 0; ui.refresh(); }
    saveAcc += dt;
    if (saveAcc > 15) { saveAcc = 0; MG.saveGame(game); }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => { if (document.hidden) MG.saveGame(game); });
  window.addEventListener('pagehide', () => MG.saveGame(game));
})();
