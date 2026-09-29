// 캔버스 렌더링: 배경, 원목, 버섯, 파티클, 스와이프 궤적
(function (G) {
  'use strict';
  const MG = G.MG;
  const D = MG.DATA;
  const TAU = Math.PI * 2;

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rr(p, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    p.moveTo(x + r, y);
    p.arcTo(x + w, y, x + w, y + h, r);
    p.arcTo(x + w, y + h, x, y + h, r);
    p.arcTo(x, y + h, x, y, r);
    p.arcTo(x, y, x + w, y, r);
    p.closePath();
  }

  function ellipsePath(cx, cy, rx, ry, rot) {
    const p = new Path2D();
    p.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU);
    return p;
  }

  // ── 버섯 모양 정의 (원점 = 원목 표면, 위쪽이 -y) ────────────────
  function shapeOf(shape, S) {
    const o = { stem: null, stems: null, cap: new Path2D(), box: null, face: null };
    const c = o.cap;
    switch (shape) {
      case 'wide':
        o.stem = [-0.16 * S, -0.45 * S, 0.32 * S, 0.45 * S, 0.1 * S];
        c.moveTo(-0.62 * S, -0.4 * S);
        c.bezierCurveTo(-0.58 * S, -0.84 * S, 0.58 * S, -0.84 * S, 0.62 * S, -0.4 * S);
        c.quadraticCurveTo(0, -0.28 * S, -0.62 * S, -0.4 * S);
        o.box = { cx: 0, cy: -0.55 * S, rx: 0.6 * S, ry: 0.2 * S };
        o.face = { x: 0, y: -0.2 * S, k: 0.85 * S };
        break;
      case 'bell':
        o.stem = [-0.14 * S, -0.55 * S, 0.28 * S, 0.55 * S, 0.1 * S];
        c.moveTo(-0.42 * S, -0.45 * S);
        c.bezierCurveTo(-0.38 * S, -0.82 * S, -0.16 * S, -1.12 * S, 0, -1.12 * S);
        c.bezierCurveTo(0.16 * S, -1.12 * S, 0.38 * S, -0.82 * S, 0.42 * S, -0.45 * S);
        c.quadraticCurveTo(0, -0.35 * S, -0.42 * S, -0.45 * S);
        o.box = { cx: 0, cy: -0.72 * S, rx: 0.4 * S, ry: 0.32 * S };
        o.face = { x: 0, y: -0.24 * S, k: 0.75 * S };
        break;
      case 'flat':
        o.stem = [-0.12 * S, -0.42 * S, 0.24 * S, 0.42 * S, 0.08 * S];
        c.ellipse(0.03 * S, -0.5 * S, 0.54 * S, 0.22 * S, -0.12, 0, TAU);
        o.box = { cx: 0.03 * S, cy: -0.5 * S, rx: 0.54 * S, ry: 0.22 * S };
        o.face = { x: 0.03 * S, y: -0.49 * S, k: 0.8 * S };
        break;
      case 'tall': {
        const heads = [[-0.2, -0.86, -0.35], [0, -1.02, 0], [0.2, -0.82, 0.35]];
        o.stems = heads.map(h => [h[0] * 0.35 * S, -0.1 * S, h[0] * S, h[1] * S + 0.05 * S]);
        heads.forEach(h => c.addPath(ellipsePath(h[0] * S, h[1] * S, 0.14 * S, 0.1 * S, h[2])));
        o.base = [0, -0.1 * S, 0.24 * S, 0.15 * S];
        o.box = { cx: 0, cy: -0.9 * S, rx: 0.34 * S, ry: 0.14 * S };
        o.face = { x: 0, y: -0.11 * S, k: 0.55 * S };
        break;
      }
      case 'puff':
        c.ellipse(0, -0.42 * S, 0.44 * S, 0.42 * S, 0, 0, TAU);
        o.box = { cx: 0, cy: -0.46 * S, rx: 0.44 * S, ry: 0.4 * S };
        o.face = { x: 0, y: -0.36 * S, k: 1 * S };
        break;
      case 'crystal': {
        o.stem = [-0.15 * S, -0.5 * S, 0.3 * S, 0.5 * S, 0.06 * S];
        const pts = [[-0.52, -0.42], [-0.38, -0.8], [-0.12, -1.02], [0.16, -1.05], [0.4, -0.82], [0.52, -0.42], [0, -0.34]];
        c.moveTo(pts[0][0] * S, pts[0][1] * S);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * S, pts[i][1] * S);
        c.closePath();
        o.facets = pts;
        o.box = { cx: 0, cy: -0.7 * S, rx: 0.5 * S, ry: 0.3 * S };
        o.face = { x: 0, y: -0.2 * S, k: 0.8 * S };
        break;
      }
      case 'star': {
        o.stem = [-0.13 * S, -0.45 * S, 0.26 * S, 0.45 * S, 0.08 * S];
        const cy = -0.74 * S;
        for (let i = 0; i < 10; i++) {
          const r = (i % 2 ? 0.24 : 0.5) * S;
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const x = Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.closePath();
        o.box = { cx: 0, cy, rx: 0.45 * S, ry: 0.42 * S };
        o.face = { x: 0, y: -0.2 * S, k: 0.7 * S };
        break;
      }
      default: // round
        o.stem = [-0.21 * S, -0.52 * S, 0.42 * S, 0.52 * S, 0.14 * S];
        c.moveTo(-0.52 * S, -0.42 * S);
        c.bezierCurveTo(-0.54 * S, -1.08 * S, 0.54 * S, -1.08 * S, 0.52 * S, -0.42 * S);
        c.quadraticCurveTo(0, -0.3 * S, -0.52 * S, -0.42 * S);
        o.box = { cx: 0, cy: -0.64 * S, rx: 0.52 * S, ry: 0.3 * S };
        o.face = { x: 0, y: -0.22 * S, k: 1 * S };
    }
    return o;
  }

  const SPOTS = [[-0.55, 0.1, 0.19], [0.05, -0.6, 0.15], [0.5, -0.05, 0.17], [-0.12, 0.35, 0.1], [0.28, 0.5, 0.09], [-0.45, -0.5, 0.1]];

  function drawPattern(ctx, pat, L, box, S, t, colSpot) {
    const { cx, cy, rx, ry } = box;
    ctx.fillStyle = colSpot;
    ctx.strokeStyle = colSpot;
    switch (pat) {
      case 'spots':
        for (const s of SPOTS) {
          ctx.beginPath();
          ctx.ellipse(cx + s[0] * rx, cy + s[1] * ry * 1.3, s[2] * rx, s[2] * rx * 0.8, 0, 0, TAU);
          ctx.fill();
        }
        break;
      case 'dots':
        for (let i = 0; i < 12; i++) {
          const a = i * 2.39996, r = Math.sqrt((i + 0.5) / 12);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r * rx * 0.9, cy + Math.sin(a) * r * ry * 1.2, 0.035 * S, 0, TAU);
          ctx.fill();
        }
        break;
      case 'cracks':
        ctx.lineWidth = 0.035 * S;
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI * 0.85 + i * 0.4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * rx * 0.2, cy + Math.sin(a) * ry * 0.3);
          ctx.lineTo(cx + Math.cos(a + 0.1) * rx * 0.6, cy + Math.sin(a + 0.1) * ry * 0.9);
          ctx.lineTo(cx + Math.cos(a - 0.05) * rx * 0.95, cy + Math.sin(a - 0.05) * ry * 1.4);
          ctx.stroke();
        }
        break;
      case 'zigzag': {
        ctx.lineWidth = 0.07 * S;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const n = 6;
        for (let i = 0; i <= n; i++) {
          const x = cx - rx + (2 * rx * i) / n;
          const y = cy + (i % 2 ? -0.35 : 0.35) * ry;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      }
      case 'stars':
        for (let i = 0; i < 7; i++) {
          const a = i * 2.39996 + 0.5, r = Math.sqrt((i + 0.5) / 7);
          const x = cx + Math.cos(a) * r * rx * 0.85, y = cy + Math.sin(a) * r * ry * 1.1;
          const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
          sparkle(ctx, x, y, (0.03 + 0.04 * tw) * S);
        }
        break;
      case 'rings':
        ctx.lineWidth = 0.025 * S;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(cx, cy + ry * 0.4, rx * 0.28 * i, ry * 0.4 * i, 0, Math.PI, TAU);
          ctx.stroke();
        }
        break;
      case 'clock': {
        const r = Math.min(rx, ry * 1.6) * 0.55;
        const y0 = cy + ry * 0.1;
        ctx.beginPath(); ctx.arc(cx, y0, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2b4a45'; ctx.lineWidth = 0.035 * S; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, y0); ctx.lineTo(cx + Math.cos(t * 2) * r * 0.75, y0 + Math.sin(t * 2) * r * 0.75);
        ctx.moveTo(cx, y0); ctx.lineTo(cx + Math.cos(t / 6) * r * 0.5, y0 + Math.sin(t / 6) * r * 0.5);
        ctx.stroke();
        break;
      }
      case 'shine': {
        const x = cx - rx + ((t * 0.6) % 1.6) * 2 * rx;
        const g = ctx.createLinearGradient(x - rx * 0.3, 0, x + rx * 0.3, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - rx * 1.5, cy - ry * 3, rx * 3, ry * 6);
        break;
      }
    }
  }

  function sparkle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }

  function drawFace(ctx, f, awake, blink, mood) {
    const k = f.k;
    ctx.save();
    ctx.translate(f.x, f.y);
    // 볼터치
    ctx.fillStyle = 'rgba(255,120,130,0.35)';
    ctx.beginPath(); ctx.ellipse(-0.15 * k, 0.045 * k, 0.05 * k, 0.03 * k, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.15 * k, 0.045 * k, 0.05 * k, 0.03 * k, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b1d14';
    ctx.strokeStyle = '#2b1d14';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 0.025 * k);
    if (awake && !blink) {
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.arc(sx * 0.085 * k, 0, 0.034 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx * 0.085 * k + 0.012 * k, -0.012 * k, 0.011 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2b1d14';
      }
    } else {
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.arc(sx * 0.085 * k, -0.01 * k, 0.03 * k, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
    }
    ctx.beginPath();
    if (mood === 'hit') ctx.arc(0, 0.07 * k, 0.03 * k, 0, TAU);
    else ctx.arc(0, 0.035 * k, 0.03 * k, 0.1 * Math.PI, 0.9 * Math.PI);
    if (mood === 'hit') ctx.stroke(); else ctx.stroke();
    ctx.restore();
  }

  // 버섯 그리기. opt: { g, t, ph, silhouette, hit, hp }
  function drawMushroom(ctx, x, y, size, sp, opt) {
    opt = opt || {};
    const L = sp.look;
    const g = opt.g === undefined ? 1 : opt.g;
    const t = opt.t || 0;
    const ph = opt.ph || 0;
    const ripe = g >= 1;
    const sc = ripe ? 1 : 0.16 + 0.84 * easeOut(clamp(g, 0, 1));
    const S = size * sc * (L.scale || 1);
    const sil = opt.silhouette;

    ctx.save();
    ctx.translate(x, y);
    if (ripe) {
      const w = Math.sin(t * 2.6 + ph);
      ctx.rotate(w * 0.05);
      const sq = 1 + Math.sin(t * 5.2 + ph) * 0.03;
      ctx.scale(2 - sq, sq);
    }
    if (opt.hit) { const h = opt.hit; ctx.scale(1 + h * 0.18, 1 - h * 0.18); }
    if (L.alpha && !sil) ctx.globalAlpha = L.alpha * (0.85 + 0.15 * Math.sin(t * 2 + ph));

    const shp = shapeOf(L.shape, S);
    let cap = L.cap, cap2 = L.cap2;
    if (L.rainbow) {
      const h = ((t * 70 + ph * 60) % 360 + 360) % 360;
      cap = `hsl(${h},85%,58%)`;
      cap2 = `hsl(${(h + 50) % 360},95%,75%)`;
    }
    const stem = sil ? '#000' : L.stem;
    const outline = sil ? 'rgba(0,0,0,0)' : 'rgba(45,25,15,0.55)';
    const lw = Math.max(1, 0.04 * S);

    // 줄기
    ctx.fillStyle = stem;
    ctx.strokeStyle = outline;
    ctx.lineWidth = lw;
    if (shp.stems) {
      ctx.lineCap = 'round';
      for (const st of shp.stems) {
        ctx.strokeStyle = outline; ctx.lineWidth = 0.13 * S;
        ctx.beginPath(); ctx.moveTo(st[0], st[1]); ctx.lineTo(st[2], st[3]); ctx.stroke();
        ctx.strokeStyle = stem; ctx.lineWidth = 0.09 * S;
        ctx.beginPath(); ctx.moveTo(st[0], st[1]); ctx.lineTo(st[2], st[3]); ctx.stroke();
      }
      const b = shp.base;
      ctx.beginPath(); ctx.ellipse(b[0], b[1], b[2], b[3], 0, 0, TAU);
      ctx.fillStyle = stem; ctx.fill();
      ctx.strokeStyle = outline; ctx.lineWidth = lw; ctx.stroke();
    } else if (shp.stem) {
      const p = new Path2D();
      const s = shp.stem;
      rr(p, s[0], s[1], s[2], s[3], s[4]);
      ctx.fill(p); ctx.stroke(p);
    }

    // 갓
    if (L.glow && !sil && ripe) {
      ctx.shadowColor = L.glow;
      ctx.shadowBlur = S * (0.35 + 0.15 * Math.sin(t * 3 + ph));
    }
    if (sil) ctx.fillStyle = '#000';
    else {
      const b = shp.box;
      const grd = ctx.createLinearGradient(0, b.cy - b.ry * 1.6, 0, b.cy + b.ry * 1.2);
      grd.addColorStop(0, cap2);
      grd.addColorStop(1, cap);
      ctx.fillStyle = grd;
    }
    ctx.fill(shp.cap);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    if (!sil) {
      ctx.save();
      ctx.clip(shp.cap);
      if (shp.facets) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 0.03 * S;
        ctx.beginPath();
        for (let i = 1; i < 6; i++) { ctx.moveTo(0, -0.34 * S); ctx.lineTo(shp.facets[i][0] * S, shp.facets[i][1] * S); }
        ctx.stroke();
      }
      if (L.pattern) drawPattern(ctx, L.pattern, L, shp.box, S, t + ph, L.spots || '#ffffff');
      // 하이라이트
      const b = shp.box;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(b.cx - b.rx * 0.35, b.cy - b.ry * 0.55, b.rx * 0.28, b.ry * 0.35, -0.4, 0, TAU);
      ctx.fill();
      if (opt.hit) { ctx.fillStyle = `rgba(255,255,255,${opt.hit * 0.7})`; ctx.fillRect(-S * 2, -S * 3, S * 4, S * 4); }
      ctx.restore();
      ctx.strokeStyle = outline;
      ctx.lineWidth = lw;
      ctx.stroke(shp.cap);

      if (g > 0.35) {
        const blink = ((t + ph * 3) % 4.2) < 0.13;
        drawFace(ctx, shp.face, ripe, blink, opt.hit ? 'hit' : '');
      }
    }
    ctx.restore();

    // 거대 버섯 체력 표시
    if (opt.hp > 1 && ripe && !sil) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(60,30,10,0.8)';
      ctx.lineWidth = 1.5;
      const n = opt.hp, r = Math.max(3, size * 0.07);
      const top = y - S * 1.2;
      for (let i = 0; i < n; i++) {
        const px = x + (i - (n - 1) / 2) * r * 2.6;
        ctx.beginPath(); ctx.arc(px, top, r, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }
  MG.drawMushroom = drawMushroom;

  // 도감용 아이콘 (dataURL 캐시)
  const iconCache = {};
  MG.speciesIcon = function (spId, silhouette) {
    const key = spId + (silhouette ? ':s' : '');
    if (iconCache[key]) return iconCache[key];
    const sp = D.SP[spId];
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const ctx = c.getContext('2d');
    const size = 62 / Math.max(1, (sp.look.scale || 1) * 0.85);
    drawMushroom(ctx, 48, 88, size, sp, { g: 1, t: 1.3, silhouette: silhouette, ph: 0 });
    if (silhouette) {
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = 'rgba(60,45,35,0.45)';
      ctx.fillRect(0, 0, 96, 96);
    }
    return (iconCache[key] = c.toDataURL());
  };

  // ── 렌더러 ─────────────────────────────────────────────────────
  class Renderer {
    constructor(canvas, game) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.game = game;
      this.parts = [];
      this.texts = [];
      this.flyers = [];
      this.trail = [];
      this.motes = [];
      this.shake = 0;
      this.bg = null;
      this.bgKey = '';
      this.snailX = 0.2;
      this.snailDir = 1;
      this.snailZaps = [];
      this.resize();
    }

    resize() {
      const r = this.cv.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.cv.width = Math.round(this.w * this.dpr);
      this.cv.height = Math.round(this.h * this.dpr);
      this.layout();
      this.bgKey = '';
    }

    layout() {
      const w = this.w, h = this.h;
      const lw = Math.min(w * 0.92, 1100);
      const lh = Math.min(h * 0.24, lw * 0.21);
      const log = this.log = { x: (w - lw) / 2, y: h * 0.68 - lh * 0.45, w: lw, h: lh };
      const spacing = lw * 0.84 / 10;
      this.msize = Math.min(lh * 0.8, spacing * 1.15, h * 0.16);
      this.slotXY = D.SLOT_POS.map(p => ({
        x: log.x + lw * (0.1 + 0.84 * p.u),
        y: log.y + lh * (0.16 + 0.46 * p.v),
      }));
    }

    // 좌표 → 근처 버섯 자리
    slotsNear(x, y, rad) {
      const out = [];
      const r2 = rad * rad;
      for (let i = 0; i < this.game.slots; i++) {
        const p = this.slotXY[i];
        const dx = p.x - x, dy = (p.y - this.msize * 0.4) - y;
        if (dx * dx + dy * dy < r2) out.push(i);
      }
      return out;
    }

    hitCenter(i) {
      const m = this.game.field()[i].m;
      const sp = m && D.SP[m.sp];
      const sc = sp ? (sp.look.scale || 1) : 1;
      const p = this.slotXY[i];
      return { x: p.x, y: p.y - this.msize * 0.5 * sc, r: this.msize * 0.55 * sc };
    }

    // 선분과 교차하는 다 자란 버섯
    segmentHits(ax, ay, bx, by) {
      const out = [];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      for (let i = 0; i < this.game.slots; i++) {
        if (!this.game.isRipe(i)) continue;
        const c = this.hitCenter(i);
        let t = ((c.x - ax) * dx + (c.y - ay) * dy) / len2;
        t = clamp(t, 0, 1);
        const px = ax + dx * t - c.x, py = ay + dy * t - c.y;
        if (px * px + py * py < c.r * c.r) out.push(i);
      }
      return out;
    }

    // ── 이펙트 ───────────────────────────────────────────────────
    addTrail(x, y, now) { this.trail.push({ x, y, t: now }); }

    sprayFx(x, y) {
      if (!this.game.s.settings.particles && this.parts.length > 30) return;
      for (let i = 0; i < 9; i++) {
        this.parts.push({
          x: x + (Math.random() - 0.5) * 10, y,
          vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 120,
          g: 520, life: 0.7, max: 0.7, r: 2 + Math.random() * 3,
          c: Math.random() < 0.5 ? '#7fdcff' : '#b8f0ff', kind: 'drop',
        });
      }
    }

    burst(x, y, color, n, speed) {
      if (this.parts.length > 500) return;
      if (!this.game.s.settings.particles) n = Math.min(n, 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, v = (0.4 + Math.random()) * speed;
        this.parts.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4,
          g: 400, life: 0.6 + Math.random() * 0.4, max: 1, r: 2 + Math.random() * 3.5,
          c: color, kind: Math.random() < 0.3 ? 'spark' : 'bit', rot: Math.random() * TAU,
        });
      }
    }

    text(x, y, str, color, size, life) {
      if (this.texts.length > 45) this.texts.shift();
      this.texts.push({ x, y, str, color, size: size || 16, life: life || 1, max: life || 1 });
    }

    onEvent(e) {
      const g = this.game;
      const p = e.idx !== undefined ? this.slotXY[e.idx] : null;
      switch (e.type) {
        case 'harvest': {
          const sp = D.SP[e.sp];
          const c = this.hitCenter(e.idx);
          const col = sp.look.rainbow ? '#ffd1f7' : sp.look.cap;
          this.burst(c.x, c.y, col, sp.rarity === 'common' ? 8 : 16, 180);
          if (sp.rarity !== 'common') this.burst(c.x, c.y, '#fff7c2', 6, 240);
          const big = e.crit ? 22 : 15;
          const txt = (e.crit ? '대박! ' : '') + '+' + MG.fmt(e.value);
          this.text(c.x, c.y - 10, txt, e.crit ? '#ff4d6d' : '#fff8dc', big, e.crit ? 1.4 : 0.9);
          if (this.flyers.length < 26 && g.s.settings.particles) {
            this.flyers.push({ sp, x: c.x, y: p.y, sx: c.x, sy: p.y, t: 0, dur: 0.55 + Math.random() * 0.2, ph: Math.random() * 6 });
          }
          if (e.crit) this.shake = Math.max(this.shake, 6);
          break;
        }
        case 'hit': {
          const c = this.hitCenter(e.idx);
          this.burst(c.x, c.y, '#ffffff', 10, 200);
          this.text(c.x, c.y - 20, '퍽!', '#ffe08a', 18, 0.6);
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'ripe':
          if (p && g.s.settings.particles && this.parts.length < 300) this.burst(p.x, p.y - this.msize * 0.6, '#fffbe0', 3, 60);
          break;
        case 'combo':
          this.text(this.w / 2, this.log.y - this.msize * 1.5, `${e.n} 콤보! ×${e.bonus.toFixed(2)}`, '#ffe45e', 26, 1.3);
          break;
        case 'effect': {
          const fx = D.EFFECTS[e.effect];
          this.text(this.w / 2, this.log.y - this.msize * 2.1, `${fx.icon} ${fx.name}!`, '#ffffff', 24, 1.5);
          if (e.effect === 'chain') this.shake = Math.max(this.shake, 8);
          if (e.effect === 'spore') for (let i = 0; i < 40; i++) this.motes.push(this.mote(true));
          break;
        }
        case 'snail':
          if (p) this.snailZaps.push({ x: p.x, y: p.y - this.msize * 0.4, life: 0.35 });
          break;
        case 'switchLog':
        case 'unlockLog':
        case 'prestige':
          this.bgKey = '';
          this.parts.length = 0;
          break;
      }
    }

    mote(burst) {
      const night = D.LOG[this.game.s.currentLog].theme.night;
      return {
        x: Math.random() * this.w,
        y: burst ? this.log.y + Math.random() * this.log.h * 0.5 : this.h * (0.2 + Math.random() * 0.7),
        vx: (Math.random() - 0.5) * 12, vy: burst ? -30 - Math.random() * 40 : -5 - Math.random() * 10,
        r: 1 + Math.random() * 2.2, life: 4 + Math.random() * 4, max: 8,
        c: night ? '#fff6b0' : 'rgba(255,255,240,0.9)', ph: Math.random() * 6,
      };
    }

    // ── 배경 (캐시) ───────────────────────────────────────────────
    buildBg() {
      const logDef = D.LOG[this.game.s.currentLog];
      const th = logDef.theme;
      const c = document.createElement('canvas');
      c.width = this.cv.width; c.height = this.cv.height;
      const ctx = c.getContext('2d');
      ctx.scale(this.dpr, this.dpr);
      const w = this.w, h = this.h, L = this.log;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, th.sky[0]);
      sky.addColorStop(1, th.sky[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      let seed = logDef.index * 97 + 13;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

      if (th.deco === 'moon' || th.deco === 'stars' || th.deco === 'crystal') {
        for (let i = 0; i < 90; i++) {
          ctx.fillStyle = `rgba(255,255,240,${0.2 + rnd() * 0.6})`;
          ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h * 0.6, rnd() * 1.6 + 0.3, 0, TAU); ctx.fill();
        }
      }
      if (th.deco === 'moon') {
        const mx = w * 0.8, my = h * 0.18, mr = Math.min(w, h) * 0.08;
        ctx.shadowColor = '#fff6c8'; ctx.shadowBlur = mr;
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (th.deco === 'stars') {
        const neb = ctx.createRadialGradient(w * 0.3, h * 0.25, 0, w * 0.3, h * 0.25, w * 0.5);
        neb.addColorStop(0, 'rgba(160,80,220,0.35)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
      }
      if (!th.night) {
        // 햇살
        ctx.save();
        ctx.globalAlpha = 0.18;
        for (let i = 0; i < 4; i++) {
          const x = w * (0.15 + i * 0.22);
          const grd = ctx.createLinearGradient(x, 0, x + w * 0.1, h);
          grd.addColorStop(0, '#fffbe6'); grd.addColorStop(1, 'rgba(255,251,230,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * 0.06, 0); ctx.lineTo(x + w * 0.2, h); ctx.lineTo(x + w * 0.1, h); ctx.fill();
        }
        ctx.restore();
      }

      // 먼 나무/종유석 실루엣
      ctx.fillStyle = th.far;
      const horizon = L.y + L.h * 0.15;
      if (th.deco === 'crystal') {
        for (let i = 0; i < 14; i++) {
          const x = rnd() * w, bw = 20 + rnd() * 50, bh = 40 + rnd() * h * 0.3;
          ctx.beginPath(); ctx.moveTo(x - bw / 2, 0); ctx.lineTo(x + bw / 2, 0); ctx.lineTo(x, bh); ctx.fill();
        }
        for (let i = 0; i < 10; i++) {
          const x = rnd() * w, bw = 14 + rnd() * 30, bh = 30 + rnd() * 90;
          ctx.fillStyle = `rgba(170,220,255,${0.25 + rnd() * 0.3})`;
          ctx.beginPath(); ctx.moveTo(x - bw / 2, horizon); ctx.lineTo(x, horizon - bh); ctx.lineTo(x + bw / 2, horizon); ctx.fill();
        }
      } else {
        for (let i = 0; i < 16; i++) {
          const x = rnd() * w, tw = 40 + rnd() * 80, th2 = h * (0.25 + rnd() * 0.35);
          ctx.globalAlpha = 0.5 + rnd() * 0.4;
          ctx.fillRect(x - tw * 0.12, horizon - th2, tw * 0.24, th2);
          ctx.beginPath(); ctx.ellipse(x, horizon - th2, tw * 0.6, tw * 0.55, 0, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // 땅
      const gy = L.y + L.h * 0.55;
      const grd = ctx.createLinearGradient(0, gy, 0, h);
      grd.addColorStop(0, th.ground);
      grd.addColorStop(1, shade(th.ground, -0.35));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(0, gy + 10);
      for (let x = 0; x <= w; x += 40) ctx.lineTo(x, gy + Math.sin(x * 0.02 + logDef.index) * 6);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      // 풀
      ctx.strokeStyle = shade(th.ground, 0.25);
      ctx.lineWidth = 2;
      for (let i = 0; i < 70; i++) {
        const x = rnd() * w, y = gy + 8 + rnd() * (h - gy);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3, y - 8, x + 1 + rnd() * 6, y - 12 - rnd() * 8); ctx.stroke();
      }

      this.drawLog(ctx, th, rnd);
      this.bg = c;
    }

    drawLog(ctx, th, rnd) {
      const L = this.log;
      const endR = L.h * 0.26;
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(L.x + L.w / 2, L.y + L.h * 1.02, L.w * 0.52, L.h * 0.14, 0, 0, TAU); ctx.fill();

      // 몸통
      const body = new Path2D();
      body.moveTo(L.x + endR, L.y);
      body.lineTo(L.x + L.w - endR * 0.6, L.y);
      body.ellipse(L.x + L.w - endR * 0.6, L.y + L.h / 2, endR * 0.6, L.h / 2, 0, -Math.PI / 2, Math.PI / 2);
      body.lineTo(L.x + endR, L.y + L.h);
      body.closePath();
      const grd = ctx.createLinearGradient(0, L.y, 0, L.y + L.h);
      grd.addColorStop(0, th.barkL);
      grd.addColorStop(0.35, th.bark);
      grd.addColorStop(1, th.barkD);
      ctx.fillStyle = grd;
      ctx.fill(body);

      ctx.save();
      ctx.clip(body);
      // 껍질 결
      ctx.strokeStyle = th.deco === 'birch' ? 'rgba(90,80,70,0.25)' : 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const y0 = L.y + L.h * (0.1 + i * 0.1);
        ctx.beginPath();
        ctx.moveTo(L.x, y0);
        for (let x = L.x; x < L.x + L.w; x += 30) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 3 + (rnd() - 0.5) * 3);
        ctx.stroke();
      }
      if (th.deco === 'birch') {
        ctx.fillStyle = '#2f2a26';
        for (let i = 0; i < 40; i++) {
          const x = L.x + rnd() * L.w, y = L.y + rnd() * L.h;
          ctx.beginPath(); ctx.ellipse(x, y, 6 + rnd() * 16, 1.5 + rnd() * 2, 0, 0, TAU); ctx.fill();
        }
      }
      if (th.deco === 'moss' || th.deco === 'leaves') {
        ctx.fillStyle = th.deco === 'moss' ? 'rgba(111,163,71,0.85)' : 'rgba(140,200,90,0.8)';
        for (let i = 0; i < 26; i++) {
          const x = L.x + rnd() * L.w, y = L.y + rnd() * L.h * 0.35;
          ctx.beginPath(); ctx.ellipse(x, y, 10 + rnd() * 24, 4 + rnd() * 7, 0, 0, TAU); ctx.fill();
        }
      }
      if (th.deco === 'crystal' || th.deco === 'stars') {
        ctx.strokeStyle = th.deco === 'crystal' ? 'rgba(170,230,255,0.7)' : 'rgba(255,155,224,0.7)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          let x = L.x + rnd() * L.w, y = L.y + L.h * (0.3 + rnd() * 0.6);
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += 10 + rnd() * 20; y += (rnd() - 0.5) * 18; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      }
      // 윗면 광택
      const top = ctx.createLinearGradient(0, L.y, 0, L.y + L.h * 0.25);
      top.addColorStop(0, 'rgba(255,255,255,0.22)');
      top.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = top;
      ctx.fillRect(L.x, L.y, L.w, L.h * 0.25);
      ctx.restore();
      ctx.strokeStyle = 'rgba(30,15,5,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke(body);

      // 단면 (나이테)
      const cx = L.x + endR, cy = L.y + L.h / 2;
      ctx.fillStyle = th.barkD;
      ctx.beginPath(); ctx.ellipse(cx, cy, endR, L.h / 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = th.ring;
      ctx.beginPath(); ctx.ellipse(cx, cy, endR * 0.86, L.h / 2 * 0.88, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = th.ringD;
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 5; i++) {
        ctx.beginPath(); ctx.ellipse(cx + i * 0.6, cy, endR * 0.16 * i, L.h / 2 * 0.17 * i, 0, 0, TAU); ctx.stroke();
      }
    }

    // ── 매 프레임 ────────────────────────────────────────────────
    draw(t, dt) {
      const g = this.game, s = g.s, ctx = this.ctx;
      const key = s.currentLog + ':' + this.w + 'x' + this.h;
      if (this.bgKey !== key) { this.buildBg(); this.bgKey = key; this.motes = []; }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      let sx = 0, sy = 0;
      if (this.shake > 0) {
        sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake;
        this.shake = Math.max(0, this.shake - dt * 30);
      }
      ctx.drawImage(this.bg, sx * this.dpr, sy * this.dpr);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, sx * this.dpr, sy * this.dpr);

      const L = this.log;
      // 촉촉함 (영양)
      const wet = s.nutrient > 0 ? clamp(s.nutrient / g.cap, 0, 1) : 0;
      if (wet > 0) {
        ctx.fillStyle = `rgba(40,110,170,${0.13 * wet})`;
        ctx.beginPath();
        ctx.ellipse(L.x + L.w / 2, L.y + L.h * 0.4, L.w * 0.46, L.h * 0.38, 0, 0, TAU);
        ctx.fill();
      }

      // 먼지/포자
      const want = s.settings.particles ? 26 : 8;
      while (this.motes.length < want) this.motes.push(this.mote(false));
      ctx.save();
      for (let i = this.motes.length - 1; i >= 0; i--) {
        const m = this.motes[i];
        m.life -= dt; m.x += (m.vx + Math.sin(t + m.ph) * 6) * dt; m.y += m.vy * dt;
        if (m.life <= 0 || m.y < -10) { this.motes.splice(i, 1); continue; }
        ctx.globalAlpha = clamp(m.life / 2, 0, 1) * 0.7;
        ctx.fillStyle = m.c;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // 버섯 자리 + 버섯
      const f = g.field();
      for (const i of D.DRAW_ORDER) {
        if (i >= g.slots) continue;
        const p = this.slotXY[i];
        ctx.fillStyle = 'rgba(30,15,5,0.28)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, this.msize * 0.3, this.msize * 0.08, 0, 0, TAU); ctx.fill();
        const m = f[i].m;
        if (m) {
          const sp = D.SP[m.sp];
          drawMushroom(ctx, p.x, p.y, this.msize, sp, { g: m.g, t, ph: m.ph, hit: m.hit, hp: m.hp });
        }
      }

      this.drawSnail(ctx, t, dt);

      // 축제 오버레이
      if (s.frenzy > 0) {
        ctx.save();
        ctx.globalAlpha = 0.1 + 0.05 * Math.sin(t * 6);
        ctx.fillStyle = `hsl(${(t * 90) % 360},90%,60%)`;
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.restore();
      }

      this.drawParticles(ctx, dt);
      this.drawFlyers(ctx, t, dt);
      this.drawTexts(ctx, dt);
      this.drawTrail(ctx, t);
    }

    drawSnail(ctx, t, dt) {
      const g = this.game;
      if (!(g.snailInterval < Infinity)) return;
      const L = this.log;
      this.snailX += this.snailDir * dt * 0.04;
      if (this.snailX > 0.92) this.snailDir = -1;
      if (this.snailX < 0.12) this.snailDir = 1;
      const x = L.x + L.w * this.snailX, y = L.y + L.h * 0.97;
      const k = Math.max(10, this.msize * 0.34);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(this.snailDir, 1);
      const bob = Math.sin(t * 6) * 0.05 * k;
      ctx.fillStyle = '#f2dcb3';
      ctx.strokeStyle = 'rgba(60,30,10,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, -0.2 * k, 1.1 * k, 0.28 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.8 * k, -0.35 * k); ctx.lineTo(1.0 * k, -0.95 * k + bob); ctx.moveTo(1.0 * k, -0.35 * k); ctx.lineTo(1.3 * k, -0.85 * k + bob); ctx.stroke();
      ctx.fillStyle = '#2b1d14';
      ctx.beginPath(); ctx.arc(1.0 * k, -0.95 * k + bob, 0.08 * k, 0, TAU); ctx.arc(1.3 * k, -0.85 * k + bob, 0.08 * k, 0, TAU); ctx.fill();
      const shell = ctx.createRadialGradient(-0.2 * k, -0.8 * k, 0.1 * k, -0.2 * k, -0.7 * k, 0.7 * k);
      shell.addColorStop(0, '#ffcf7a'); shell.addColorStop(1, '#c9772e');
      ctx.fillStyle = shell;
      ctx.beginPath(); ctx.arc(-0.2 * k, -0.7 * k, 0.62 * k, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,60,20,0.8)';
      ctx.beginPath();
      for (let a = 0; a < 10; a += 0.3) {
        const r = 0.05 * k * a;
        const px = -0.2 * k + Math.cos(a) * r, py = -0.7 * k + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // 달팽이 수확 섬광
      ctx.save();
      for (let i = this.snailZaps.length - 1; i >= 0; i--) {
        const z = this.snailZaps[i];
        z.life -= dt;
        if (z.life <= 0) { this.snailZaps.splice(i, 1); continue; }
        ctx.globalAlpha = z.life / 0.35;
        ctx.strokeStyle = '#fff6b0';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(x, y - k * 0.7); ctx.quadraticCurveTo((x + z.x) / 2, z.y - 40, z.x, z.y); ctx.stroke();
      }
      ctx.restore();
    }

    drawParticles(ctx, dt) {
      ctx.save();
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1);
        ctx.fillStyle = p.c;
        if (p.kind === 'spark') sparkle(ctx, p.x, p.y, p.r * 1.8);
        else if (p.kind === 'drop') { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.7, p.r, 0, 0, TAU); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    }

    drawFlyers(ctx, t, dt) {
      const tx = 34, ty = 26; // HUD 포자 아이콘 쪽으로 날아감
      for (let i = this.flyers.length - 1; i >= 0; i--) {
        const f = this.flyers[i];
        f.t += dt / f.dur;
        if (f.t >= 1) { this.flyers.splice(i, 1); continue; }
        const e = f.t * f.t;
        const mx = (f.sx + tx) / 2, my = Math.min(f.sy, ty) - 120;
        const x = (1 - e) * (1 - e) * f.sx + 2 * (1 - e) * e * mx + e * e * tx;
        const y = (1 - e) * (1 - e) * f.sy + 2 * (1 - e) * e * my + e * e * ty;
        ctx.save();
        ctx.globalAlpha = 1 - f.t * 0.5;
        drawMushroom(ctx, x, y, this.msize * (1 - f.t * 0.7), f.sp, { g: 1, t, ph: f.ph });
        ctx.restore();
      }
    }

    drawTexts(ctx, dt) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const tx = this.texts[i];
        tx.life -= dt;
        if (tx.life <= 0) { this.texts.splice(i, 1); continue; }
        tx.y -= dt * 40;
        const k = tx.life / tx.max;
        const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
        ctx.globalAlpha = clamp(k * 2, 0, 1);
        ctx.font = `${Math.round(tx.size * pop)}px Jua, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(40,20,10,0.75)';
        ctx.strokeText(tx.str, tx.x, tx.y);
        ctx.fillStyle = tx.color;
        ctx.fillText(tx.str, tx.x, tx.y);
      }
      ctx.restore();
    }

    drawTrail(ctx, now) {
      const pts = this.trail;
      while (pts.length && now - pts[0].t > 0.22) pts.shift();
      if (pts.length < 2) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      for (let i = 1; i < pts.length; i++) {
        const k = 1 - (now - pts[i].t) / 0.22;
        ctx.strokeStyle = `rgba(255,255,255,${clamp(k, 0, 1) * 0.9})`;
        ctx.lineWidth = 2 + 9 * k;
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }

  MG.Renderer = Renderer;
})(window);
