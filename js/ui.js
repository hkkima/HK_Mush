// DOM UI: HUD, 강화/원목/도감/균사/기록 탭, 토스트, 모달
(function (G) {
  'use strict';
  const MG = G.MG;
  const D = MG.DATA;
  const $ = id => document.getElementById(id);
  const fmt = MG.fmt;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  class UI {
    constructor(game) {
      this.game = game;
      this.tab = 'upgrades';
      this.hud = {
        spores: $('spores'), rate: $('rate'), nutFill: $('nutFill'), nutText: $('nutText'),
        logName: $('logName'), myc: $('myc'), mycBadge: $('mycBadge'),
        frenzy: $('frenzy'), frenzyTime: $('frenzyTime'), hint: $('hint'),
      };
      this.last = {};
      this.initTabs();
      this.initBuyAmount();
      this.buildUpgrades();
      this.buildPUpgrades();
      this.buildLogs();
      this.buildBook();
      this.initPrestige();
      this.initSettings();
      this.refresh();
    }

    // ── 공통 ─────────────────────────────────────────────────────
    initTabs() {
      document.querySelectorAll('#tabs button').forEach(b => {
        b.addEventListener('click', () => this.showTab(b.dataset.tab));
      });
    }

    showTab(name) {
      this.tab = name;
      document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
      if (name === 'logs') $('dotLogs').classList.add('hidden');
      if (name === 'book') { $('dotBook').classList.add('hidden'); this.buildBook(); }
      this.refresh();
    }

    toast(html, icon) {
      const box = $('toasts');
      const t = el('div', 'toast', (icon ? `<img src="${icon}" alt="">` : '') + `<div>${html}</div>`);
      box.appendChild(t);
      while (box.children.length > 4) box.removeChild(box.firstChild);
      setTimeout(() => t.remove(), 3200);
    }

    modal(html, buttons) {
      $('modalBody').innerHTML = html;
      const btns = $('modalBtns');
      btns.innerHTML = '';
      (buttons || [{ label: '좋아요!' }]).forEach(b => {
        const btn = el('button', b.ghost ? 'ghost' : '', b.label);
        btn.addEventListener('click', () => {
          if (b.onClick && b.onClick() === false) return;
          $('modal').classList.add('hidden');
        });
        btns.appendChild(btn);
      });
      $('modal').classList.remove('hidden');
    }

    // ── HUD (매 프레임) ──────────────────────────────────────────
    updateHud() {
      const g = this.game, s = g.s, h = this.hud;
      this.setText(h.spores, fmt(s.spores));
      this.setText(h.rate, fmt(g.rate()));
      const ratio = s.nutrient / g.cap;
      h.nutFill.style.width = (ratio * 100).toFixed(1) + '%';
      h.nutFill.classList.toggle('empty', s.nutrient <= 0);
      this.setText(h.nutText, s.nutrient <= 0 ? '영양 부족!' : Math.ceil(s.nutrient) + ' / ' + g.cap + '초');
      this.setText(h.logName, '🪵 ' + D.LOG[s.currentLog].name);
      h.mycBadge.classList.toggle('hidden', !(s.myceliumTotal > 0));
      this.setText(h.myc, fmt(s.mycelium));
      h.frenzy.classList.toggle('hidden', !(s.frenzy > 0));
      if (s.frenzy > 0) this.setText(h.frenzyTime, Math.ceil(s.frenzy) + '초');
      if (s.stats.harvested >= 6 && !h.hint.classList.contains('fade')) {
        h.hint.classList.add('fade');
        setTimeout(() => h.hint.classList.add('hidden'), 900);
      }
    }

    setText(node, txt) {
      if (node._t !== txt) { node._t = txt; node.textContent = txt; }
    }

    // ── 패널 갱신 (저빈도) ────────────────────────────────────────
    refresh() {
      this.updateUpgrades();
      this.updatePrestigeTab();
      if (this.tab === 'upgrades') return;
      if (this.tab === 'logs') this.updateLogs();
      if (this.tab === 'book') this.updateBook();
      if (this.tab === 'prestige') this.updatePUpgrades();
      if (this.tab === 'stats') this.updateStats();
    }

    // ── 강화 ─────────────────────────────────────────────────────
    initBuyAmount() {
      const s = this.game.s;
      document.querySelectorAll('#buyAmount button').forEach(b => {
        const v = b.dataset.amt === 'max' ? 'max' : +b.dataset.amt;
        b.classList.toggle('on', v === s.settings.buyAmount);
        b.addEventListener('click', () => {
          s.settings.buyAmount = v;
          document.querySelectorAll('#buyAmount button').forEach(x => x.classList.toggle('on', x === b));
          this.updateUpgrades();
        });
      });
    }

    buildUpgrades() {
      const list = $('upgradeList');
      list.innerHTML = '';
      this.upRows = D.UPGRADES.map(u => {
        const row = el('div', 'row');
        row.innerHTML = `<div class="icon">${u.icon}</div>
          <div class="info"><div class="name">${u.name} <span class="lv"></span></div>
          <div class="desc">${u.desc}</div><div class="eff"></div></div>`;
        const btn = el('button', 'buy');
        btn.addEventListener('click', () => {
          if (this.game.buy(u.id, this.game.s.settings.buyAmount)) this.updateUpgrades();
        });
        row.appendChild(btn);
        list.appendChild(row);
        return { u, row, btn, lv: row.querySelector('.lv'), eff: row.querySelector('.eff'), name: row.querySelector('.name'), desc: row.querySelector('.desc'), icon: row.querySelector('.icon') };
      });
    }

    updateUpgrades() {
      const g = this.game, s = g.s;
      let teaserShown = false;
      for (const r of this.upRows) {
        const u = r.u, l = g.lvl(u.id);
        if (!s.seen[u.id] && (l > 0 || u.base <= 15 || s.spores >= u.base * 0.5)) s.seen[u.id] = 1;
        const seen = !!s.seen[u.id];
        if (!seen) {
          if (teaserShown) { r.row.classList.add('hidden'); continue; }
          teaserShown = true;
          r.row.classList.remove('hidden');
          r.row.classList.add('teaser');
          r.icon.textContent = '❔';
          r.name.firstChild.textContent = '??? ';
          r.desc.textContent = `포자 ${fmt(u.base * 0.5)}개를 모으면 공개돼요.`;
          r.lv.textContent = '';
          r.eff.textContent = '';
          r.btn.disabled = true;
          r.btn.innerHTML = '잠김';
          continue;
        }
        r.row.classList.remove('hidden', 'teaser');
        r.icon.textContent = u.icon;
        r.name.firstChild.textContent = u.name + ' ';
        r.desc.textContent = u.desc;
        r.lv.textContent = 'Lv ' + l;
        const q = g.quote(u.id, s.settings.buyAmount);
        r.row.classList.toggle('maxed', q.maxed);
        if (q.maxed) {
          r.eff.textContent = u.fmt(u.val(l)) + ' (최대)';
          r.btn.disabled = true;
          r.btn.innerHTML = 'MAX';
        } else {
          r.eff.textContent = u.fmt(u.val(l)) + ' → ' + u.fmt(u.val(l + q.n));
          r.btn.disabled = s.spores < q.cost;
          const html = `✦ ${fmt(q.cost)}<small>${q.n > 1 ? '+' + q.n + '레벨' : '구매'}</small>`;
          if (r.btn._h !== html) { r.btn._h = html; r.btn.innerHTML = html; }
        }
      }
    }

    // ── 원목 ─────────────────────────────────────────────────────
    buildLogs() {
      const list = $('logList');
      list.innerHTML = '';
      this.logCards = D.LOGS.map(L => {
        const card = el('div', 'log-card');
        card.innerHTML = `<h4><span class="nm"></span><small class="base"></small></h4><p class="ds"></p><div class="species"></div>`;
        const btn = el('button', 'buy');
        btn.addEventListener('click', () => {
          const g = this.game;
          if (g.s.logsUnlocked.includes(L.id)) g.switchLog(L.id);
          else g.unlockLog(L.id);
          this.updateLogs();
        });
        card.appendChild(btn);
        list.appendChild(card);
        return { L, card, btn, nm: card.querySelector('.nm'), base: card.querySelector('.base'), ds: card.querySelector('.ds'), sp: card.querySelector('.species'), spKey: '' };
      });
    }

    updateLogs() {
      const g = this.game, s = g.s;
      const next = g.nextLockedLog();
      for (const c of this.logCards) {
        const L = c.L;
        const unlocked = s.logsUnlocked.includes(L.id);
        const isNext = next && next.id === L.id;
        const known = unlocked || isNext;
        c.card.className = 'log-card' + (s.currentLog === L.id ? ' current' : '') + (!unlocked ? ' locked' : '') + (!known ? ' unknown' : '');
        this.setText(c.nm, known ? '🪵 ' + L.name : '🔒 ???');
        this.setText(c.base, known ? '기본 가치 ×' + fmt(L.base) : '');
        this.setText(c.ds, known ? L.desc : '이전 원목을 해금하면 정체가 드러나요.');
        const key = D.POOL[L.id].map(sp => (s.species[sp.id] ? 1 : 0)).join('') + (known ? 'k' : '');
        if (c.spKey !== key) {
          c.spKey = key;
          c.sp.innerHTML = known ? D.POOL[L.id].map(sp => {
            const found = !!s.species[sp.id];
            return `<img src="${MG.speciesIcon(sp.id, !found)}" title="${found ? sp.name : '???'}" alt="">`;
          }).join('') : '';
        }
        if (unlocked) {
          const cur = s.currentLog === L.id;
          c.btn.disabled = cur;
          c.btn.innerHTML = cur ? '재배 중' : '이 원목으로 이동';
        } else if (isNext) {
          c.btn.disabled = s.spores < L.cost;
          c.btn.innerHTML = `✦ ${fmt(L.cost)}<small>해금하기</small>`;
        } else {
          c.btn.disabled = true;
          c.btn.innerHTML = '잠김';
        }
        c.btn.classList.toggle('hidden', !known);
      }
    }

    // ── 도감 ─────────────────────────────────────────────────────
    buildBook() {
      const g = this.game, s = g.s;
      const list = $('bookList');
      list.innerHTML = '';
      this.bookCards = [];
      for (const L of D.LOGS) {
        const pool = D.POOL[L.id];
        const visible = s.logsUnlocked.includes(L.id) || pool.some(sp => s.species[sp.id]);
        if (!visible) continue;
        const sec = el('div', 'book-log', `<h4>🪵 ${L.name}</h4>`);
        const grid = el('div', 'book-grid');
        for (const sp of pool) {
          const rec = s.species[sp.id];
          const R = D.RARITY[sp.rarity];
          const card = el('div', 'sp-card' + (rec ? '' : ' unknown'));
          card.tabIndex = 0;
          if (rec) {
            const fx = sp.effect ? D.EFFECTS[sp.effect] : null;
            card.innerHTML = `${fx ? `<span class="fx">${fx.icon}</span>` : ''}
              <img src="${MG.speciesIcon(sp.id)}" alt="">
              <div class="nm">${sp.name}</div>
              <span class="rar" style="background:${R.color}">${R.name}</span>
              <div class="stars"></div><div class="cnt"></div>
              <div class="tip">${sp.desc}<br>가치 ×${sp.value}${sp.hp > 1 ? ` · ${sp.hp}번 그어야 수확` : ''}${fx ? `<br>${fx.icon} ${fx.desc}` : ''}<br><small>별: 10·100·1천·1만·10만 수확마다 가치 ×${D.STAR_MULT}</small></div>`;
          } else {
            card.innerHTML = `<img src="${MG.speciesIcon(sp.id, true)}" alt="">
              <div class="nm">???</div><span class="rar" style="background:${R.color}">${R.name}</span>
              <div class="stars"></div><div class="cnt">미발견</div>`;
          }
          grid.appendChild(card);
          this.bookCards.push({ sp, card, stars: card.querySelector('.stars'), cnt: card.querySelector('.cnt') });
        }
        sec.appendChild(grid);
        list.appendChild(sec);
      }
      this.updateBook();
    }

    updateBook() {
      const g = this.game, s = g.s;
      for (const c of this.bookCards || []) {
        const rec = s.species[c.sp.id];
        if (!rec) continue;
        const st = MG.starsFor(rec.count);
        this.setText(c.stars, '★'.repeat(st) + '☆'.repeat(D.STAR_THRESHOLDS.length - st));
        this.setText(c.cnt, fmt(rec.count) + '개 수확');
      }
      const html = `발견 <b>${g.discovered}</b> / ${D.SPECIES.length}종 · 별 <b>${g.totalStars}</b>개<br>
        도감 보너스: 모든 가치 <b>×${MG.fmtMult(g.collectionMult)}</b>
        <br><small>새 버섯 발견마다 +10%, 별 하나마다 +3% (곱연산)</small>`;
      const sum = $('bookSummary');
      if (sum._h !== html) { sum._h = html; sum.innerHTML = html; }
    }

    // ── 균사 (환생) ───────────────────────────────────────────────
    initPrestige() {
      $('prestigeBtn').addEventListener('click', () => {
        const g = this.game;
        const gain = g.myceliumGain();
        if (gain < 1) return;
        this.modal(`<h3>🧬 포자 방출</h3><p>균사 <b>${fmt(gain)}</b>개를 얻고<br>포자·강화·원목이 초기화돼요.</p><p><small>도감, 균사 강화는 그대로 남아요.</small></p>`, [
          { label: '방출!', onClick: () => { g.prestige(); this.buildBook(); this.updateLogs(); this.refresh(); } },
          { label: '잠깐만요', ghost: true },
        ]);
      });
    }

    updatePrestigeTab() {
      const g = this.game, s = g.s;
      const gain = g.myceliumGain();
      const open = gain >= 1 || s.myceliumTotal > 0;
      const tabBtn = $('tabPrestige');
      if (open && tabBtn.classList.contains('locked')) {
        tabBtn.classList.remove('locked');
        if (!s.seen.__prestige) {
          s.seen.__prestige = 1;
          this.toast('🧬 <b>포자 방출</b>이 가능해졌어요!<small>균사 탭을 확인해보세요</small>');
        }
      }
      if (this.tab !== 'prestige') return;
      this.setText($('pGain'), fmt(gain));
      this.setText($('pNext'), '포자 ' + fmt(Math.max(0, g.nextMyceliumAt() - s.runEarned)) + '개 더');
      $('prestigeBtn').disabled = gain < 1;
      const info = `보유 균사 <b>${fmt(s.mycelium)}</b> · 누적 균사 ${fmt(s.myceliumTotal)}<br>
        누적 균사 보너스: 모든 가치 ×${MG.fmtMult(g.myceliumMult)}`;
      const mi = $('mycInfo');
      if (mi._h !== info) { mi._h = info; mi.innerHTML = info; }
    }

    buildPUpgrades() {
      const list = $('pUpgradeList');
      list.innerHTML = '';
      this.pRows = D.PUPGRADES.map(u => {
        const row = el('div', 'row');
        row.innerHTML = `<div class="icon">${u.icon}</div>
          <div class="info"><div class="name">${u.name} <span class="lv"></span></div>
          <div class="desc">${u.desc}</div><div class="eff"></div></div>`;
        const btn = el('button', 'buy purple');
        btn.addEventListener('click', () => { if (this.game.pBuy(u.id)) this.updatePUpgrades(); });
        row.appendChild(btn);
        list.appendChild(row);
        return { u, row, btn, lv: row.querySelector('.lv'), eff: row.querySelector('.eff') };
      });
    }

    updatePUpgrades() {
      const g = this.game, s = g.s;
      for (const r of this.pRows) {
        const u = r.u, l = g.plvl(u.id);
        const q = g.pQuote(u.id);
        this.setText(r.lv, 'Lv ' + l);
        this.setText(r.eff, q.maxed ? u.fmt(u.val(l)) + ' (최대)' : u.fmt(u.val(l)) + ' → ' + u.fmt(u.val(l + 1)));
        r.btn.disabled = q.maxed || s.mycelium < q.cost;
        const html = q.maxed ? 'MAX' : `🧬 ${fmt(q.cost)}`;
        if (r.btn._h !== html) { r.btn._h = html; r.btn.innerHTML = html; }
      }
    }

    // ── 기록 / 설정 ──────────────────────────────────────────────
    updateStats() {
      const g = this.game, s = g.s, st = s.stats;
      const rows = [
        ['플레이 시간', MG.fmtTime(st.playTime)],
        ['누적 포자 (전체)', fmt(s.lifetimeEarned)],
        ['이번 회차 포자', fmt(s.runEarned)],
        ['수확한 버섯', fmt(st.harvested) + '개'],
        ['최고 콤보', st.bestCombo + '콤보'],
        ['최고 한 방 수확', fmt(st.bestHarvest)],
        ['대박 횟수', fmt(st.crits) + '번'],
        ['영양제 뿌린 횟수', fmt(st.sprays) + '번'],
        ['포자 방출 횟수', s.prestiges + '번'],
        ['버섯 자리', g.slots + '칸'],
        ['성장 속도', '×' + MG.fmtMult(g.growthMult)],
        ['가치 배율 (전체)', '×' + MG.fmtMult(g.valueMult)],
        ['└ 도감 보너스', '×' + MG.fmtMult(g.collectionMult)],
        ['└ 균사 보너스', '×' + MG.fmtMult(g.myceliumMult)],
      ];
      const html = rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
      const box = $('statsList');
      if (box._h !== html) { box._h = html; box.innerHTML = html; }
    }

    initSettings() {
      const s = this.game.s;
      const cb = $('optParticles');
      cb.checked = s.settings.particles;
      cb.addEventListener('change', () => { s.settings.particles = cb.checked; });
      $('btnSave').addEventListener('click', () => { MG.saveGame(this.game); this.toast('💾 저장했어요!'); });
      $('btnExport').addEventListener('click', () => {
        const code = MG.exportSave(this.game);
        this.modal(`<h3>📤 저장 코드</h3><p>아래 코드를 복사해 보관하세요.</p><textarea readonly>${code}</textarea>`, [
          { label: '복사', onClick: () => { navigator.clipboard && navigator.clipboard.writeText(code); this.toast('복사했어요!'); } },
          { label: '닫기', ghost: true },
        ]);
        const ta = document.querySelector('#modalBody textarea');
        ta.focus(); ta.select();
      });
      $('btnImport').addEventListener('click', () => {
        this.modal(`<h3>📥 불러오기</h3><p>저장 코드를 붙여넣으세요.<br><small>현재 진행 상황은 덮어씌워져요.</small></p><textarea id="importText"></textarea>`, [
          { label: '불러오기', onClick: () => {
            const ok = MG.importSave($('importText').value.trim());
            if (!ok) { this.toast('⚠️ 올바르지 않은 코드예요'); return false; }
          } },
          { label: '취소', ghost: true },
        ]);
      });
      $('btnReset').addEventListener('click', () => {
        this.modal(`<h3>🗑️ 처음부터</h3><p>정말 모든 진행을 지울까요?<br>도감과 균사도 사라져요.</p>`, [
          { label: '지우기', onClick: () => MG.hardReset() },
          { label: '취소', ghost: true },
        ]);
      });
    }

    // ── 게임 이벤트 ──────────────────────────────────────────────
    onEvent(e) {
      const g = this.game;
      switch (e.type) {
        case 'discover': {
          const sp = D.SP[e.sp];
          const R = D.RARITY[sp.rarity];
          this.toast(`새 버섯 발견! <b style="color:${R.color}">${sp.name}</b><small>${R.name} · 도감 보너스 +10%</small>`, MG.speciesIcon(sp.id));
          if (this.tab === 'book') this.buildBook(); else $('dotBook').classList.remove('hidden');
          break;
        }
        case 'star': {
          const sp = D.SP[e.sp];
          this.toast(`<b>${sp.name}</b> ${'★'.repeat(e.stars)}<small>수확 가치 ×${D.STAR_MULT} 상승!</small>`, MG.speciesIcon(sp.id));
          break;
        }
        case 'unlockLog':
          this.toast(`🪵 <b>${D.LOG[e.id].name}</b> 해금!<small>새로운 버섯들이 기다려요</small>`);
          if (this.tab === 'book') this.buildBook();
          break;
        case 'prestige':
          this.toast(`🧬 균사 <b>+${fmt(e.gain)}</b><small>숲이 새로 태어났어요</small>`);
          break;
        case 'buy':
          if (e.id === 'snail' && g.lvl('snail') === e.n) this.toast('🐌 수확 달팽이가 원목에 올라탔어요!');
          break;
      }
      if (e.type === 'harvest') {
        const next = g.nextLockedLog();
        if (next && g.s.spores >= next.cost && !g.s.seen['__log_' + next.id]) {
          g.s.seen['__log_' + next.id] = 1;
          $('dotLogs').classList.remove('hidden');
          this.toast(`🪵 새 원목을 해금할 수 있어요!<small>원목 탭을 확인해보세요</small>`);
        }
      }
    }
  }

  MG.UI = UI;
})(window);
