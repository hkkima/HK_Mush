// 게임 로직 (DOM과 무관 — 노드 시뮬레이션에서도 그대로 사용)
(function (G) {
  'use strict';
  const MG = G.MG = G.MG || {};
  const D = MG.DATA;

  MG.SAVE_KEY = 'poslposl-mushroom-farm-v1';

  function defaultState() {
    return {
      version: 1,
      spores: 0,
      runEarned: 0,
      lifetimeEarned: 0,
      mycelium: 0,
      myceliumTotal: 0,
      prestiges: 0,
      upgrades: {},
      pUpgrades: {},
      logsUnlocked: ['oak'],
      currentLog: 'oak',
      nutrient: 12,
      frenzy: 0,
      species: {},
      seen: {},
      stats: { harvested: 0, bestCombo: 0, sprays: 0, playTime: 0, crits: 0, bestHarvest: 0 },
      settings: { particles: true, buyAmount: 1 },
      lastTick: Date.now(),
    };
  }
  MG.defaultState = defaultState;

  function starsFor(count) {
    let n = 0;
    for (const t of D.STAR_THRESHOLDS) if (count >= t) n++;
    return n;
  }
  MG.starsFor = starsFor;

  class Game {
    constructor(saved, rng) {
      const def = defaultState();
      const s = Object.assign(def, saved || {});
      s.stats = Object.assign(defaultState().stats, s.stats || {});
      s.settings = Object.assign(defaultState().settings, s.settings || {});
      if (!D.LOG[s.currentLog]) s.currentLog = 'oak';
      s.logsUnlocked = (s.logsUnlocked || ['oak']).filter(id => D.LOG[id]);
      if (!s.logsUnlocked.length) s.logsUnlocked = ['oak'];
      const savedFields = s.fields;
      delete s.fields;
      this.s = s;
      this.rng = rng || Math.random;
      this.fields = {};
      this.events = [];
      this.income = [];
      this.incomeSum = 0;
      this.autoIncomeSum = 0;
      this.clock = 0;
      this.snailTimer = 0;
      this.swipe = null;
      this.silent = false;
      this.recalc();
      if (savedFields) this.loadFields(savedFields);
    }

    // ── 레벨 / 파생 수치 ─────────────────────────────────────────
    lvl(id) { return this.s.upgrades[id] || 0; }
    plvl(id) { return this.s.pUpgrades[id] || 0; }

    recalc() {
      const U = D.UP, P = D.PUP, s = this.s;
      this.slots = Math.min(D.MAX_SLOTS, U.slots.val(this.lvl('slots')) + P.p_slots.val(this.plvl('p_slots')));
      this.sprayAmt = U.spray.val(this.lvl('spray'));
      this.sprayBoost = Math.min(0.5, 0.04 + 0.01 * this.lvl('spray'));
      this.cap = U.tank.val(this.lvl('tank'));
      this.autoRate = U.auto.val(this.lvl('auto')) + P.p_auto.val(this.plvl('p_auto'));
      this.growthMult = U.growth.val(this.lvl('growth')) * P.p_growth.val(this.plvl('p_growth'));
      this.luckMult = U.luck.val(this.lvl('luck')) * P.p_luck.val(this.plvl('p_luck'));
      this.comboStep = U.combo.val(this.lvl('combo'));
      this.spawnDelay = U.regen.val(this.lvl('regen'));
      this.critChance = U.crit.val(this.lvl('crit'));
      this.snailInterval = U.snail.val(this.lvl('snail'));
      this.snailCount = P.p_snail.val(this.plvl('p_snail'));

      let discovered = 0, stars = 0;
      for (const sp of D.SPECIES) {
        const rec = s.species[sp.id];
        if (rec && rec.count > 0) { discovered++; stars += starsFor(rec.count); }
      }
      const cm = P.p_collect.val(this.plvl('p_collect'));
      this.discovered = discovered;
      this.totalStars = stars;
      this.collectionMult = (1 + 0.1 * discovered * cm) * (1 + 0.03 * stars * cm);
      this.myceliumMult = 1 + D.MYC_BONUS * Math.sqrt(s.myceliumTotal);
      this.valueMult = U.value.val(this.lvl('value')) * P.p_value.val(this.plvl('p_value')) *
        this.collectionMult * this.myceliumMult;
      if (s.nutrient > this.cap) s.nutrient = this.cap;
    }

    maxLevel(u) {
      if (u.id === 'slots') return Math.max(0, D.MAX_SLOTS - 3 - D.PUP.p_slots.val(this.plvl('p_slots')));
      return u.max === undefined ? Infinity : u.max;
    }

    // ── 버섯밭 ───────────────────────────────────────────────────
    field(logId) {
      logId = logId || this.s.currentLog;
      let f = this.fields[logId];
      if (!f) {
        f = this.fields[logId] = [];
        for (let i = 0; i < D.MAX_SLOTS; i++) f.push({ m: null, timer: 0.5 + this.rng() * 2 });
      }
      return f;
    }

    growTime(sp) {
      return D.LOG[sp.log].growTime * D.RARITY[sp.rarity].growMul;
    }

    spawnDelayRand() {
      return this.spawnDelay * (0.6 + 0.8 * this.rng());
    }

    speciesWeight(sp) {
      const r = D.RARITY[sp.rarity];
      return r.weight * Math.pow(this.luckMult, r.tier / 4);
    }

    pickSpecies(logId) {
      const pool = D.POOL[logId];
      let total = 0;
      for (const sp of pool) total += this.speciesWeight(sp);
      let r = this.rng() * total;
      for (const sp of pool) {
        r -= this.speciesWeight(sp);
        if (r <= 0) return sp;
      }
      return pool[pool.length - 1];
    }

    sprout(slot, idx, g0) {
      const sp = this.pickSpecies(this.s.currentLog);
      slot.m = { sp: sp.id, g: g0 || 0, hp: sp.hp, ph: this.rng() * 6.283, hit: 0 };
      this.emit({ type: 'sprout', idx, sp: sp.id });
    }

    tick(dt) {
      const s = this.s;
      this.clock += dt;
      s.stats.playTime += dt;
      if (s.frenzy > 0) s.frenzy = Math.max(0, s.frenzy - dt);
      const fr = s.frenzy > 0 ? D.FRENZY_MULT : 1;

      const had = s.nutrient > 0;
      s.nutrient = Math.min(this.cap, Math.max(0, s.nutrient + (this.autoRate - D.NUTRIENT_DRAIN) * dt));
      const nf = (had || s.nutrient > 0) ? 1 : D.DROUGHT;
      const gm = this.growthMult * nf * fr;
      const sm = nf * fr;

      const f = this.field();
      for (let i = 0; i < this.slots; i++) {
        const slot = f[i];
        const m = slot.m;
        if (!m) {
          slot.timer -= dt * sm;
          if (slot.timer <= 0) this.sprout(slot, i, 0);
        } else {
          if (m.hit > 0) m.hit = Math.max(0, m.hit - dt * 4);
          if (m.g < 1) {
            m.g += dt * gm / this.growTime(D.SP[m.sp]);
            if (m.g >= 1) { m.g = 1; this.emit({ type: 'ripe', idx: i }); }
          }
        }
      }

      if (this.snailInterval < Infinity) {
        this.snailTimer += dt;
        if (this.snailTimer >= this.snailInterval) {
          const n = Math.floor(this.snailTimer / this.snailInterval);
          this.snailTimer -= n * this.snailInterval;
          this.autoHarvest(n * this.snailCount);
        }
      }

      // 최근 10초 수입 기록 정리
      const cutoff = this.clock - 10;
      while (this.income.length && this.income[0][0] < cutoff) {
        const e = this.income.shift();
        this.incomeSum -= e[1];
        if (e[2]) this.autoIncomeSum -= e[1];
      }
    }

    rate() { return Math.max(0, this.incomeSum) / Math.min(10, Math.max(1, this.clock)); }
    autoRateIncome() { return Math.max(0, this.autoIncomeSum) / Math.min(10, Math.max(1, this.clock)); }

    // ── 행동: 영양제 / 수확 ───────────────────────────────────────
    spray(nearIdxs) {
      const s = this.s;
      s.nutrient = Math.min(this.cap, s.nutrient + this.sprayAmt);
      s.stats.sprays++;
      const f = this.field();
      for (const i of nearIdxs || []) {
        if (i >= this.slots) continue;
        const slot = f[i];
        if (!slot.m) slot.timer -= 0.6;
        else if (slot.m.g < 1) {
          slot.m.g = Math.min(1, slot.m.g + this.sprayBoost);
          if (slot.m.g >= 1) this.emit({ type: 'ripe', idx: i });
        }
      }
    }

    valueOf(sp) {
      const rec = this.s.species[sp.id];
      const stars = rec ? starsFor(rec.count) : 0;
      return D.LOG[sp.log].base * sp.value * Math.pow(D.STAR_MULT, stars) * this.valueMult *
        (this.s.frenzy > 0 ? D.FRENZY_MULT : 1);
    }

    isRipe(i) {
      const slot = this.field()[i];
      return !!(slot && slot.m && slot.m.g >= 1 && i < this.slots);
    }

    harvest(i, combo, source) {
      const f = this.field();
      const slot = f[i];
      const m = slot && slot.m;
      if (!m || m.g < 1) return 0;
      const sp = D.SP[m.sp];
      if (m.hp > 1) {
        m.hp--;
        m.hit = 1;
        this.emit({ type: 'hit', idx: i, hp: m.hp, sp: sp.id });
        return 0;
      }
      slot.m = null;
      slot.timer = this.spawnDelayRand();
      let v = this.valueOf(sp);
      const crit = this.critChance > 0 && this.rng() < this.critChance;
      if (crit) { v *= D.CRIT_MULT; this.s.stats.crits++; }
      v *= 1 + this.comboStep * Math.max(0, (combo || 1) - 1);
      this.earn(v, source === 'snail');
      this.record(sp);
      if (v > this.s.stats.bestHarvest) this.s.stats.bestHarvest = v;
      this.emit({ type: 'harvest', idx: i, sp: sp.id, value: v, crit, source, combo: combo || 1 });
      if (sp.effect) this.applyEffect(sp, i);
      return v;
    }

    record(sp) {
      const s = this.s;
      const rec = s.species[sp.id] || (s.species[sp.id] = { count: 0 });
      const before = starsFor(rec.count);
      rec.count++;
      s.stats.harvested++;
      if (rec.count === 1) {
        this.recalc();
        this.emit({ type: 'discover', sp: sp.id });
      } else {
        const after = starsFor(rec.count);
        if (after > before) {
          this.recalc();
          this.emit({ type: 'star', sp: sp.id, stars: after });
        }
      }
    }

    nextCombo() { return this.swipe ? ++this.swipe.combo : 1; }

    applyEffect(sp, idx) {
      const s = this.s;
      const f = this.field();
      this.emit({ type: 'effect', effect: sp.effect, idx, sp: sp.id });
      switch (sp.effect) {
        case 'nutrient':
          s.nutrient = this.cap;
          break;
        case 'time':
          for (let j = 0; j < this.slots; j++) {
            const m = f[j].m;
            if (m && m.g < 1) {
              m.g = Math.min(1, m.g + 0.5);
              if (m.g >= 1) this.emit({ type: 'ripe', idx: j });
            }
          }
          break;
        case 'chain':
          for (let j = 0; j < this.slots; j++) {
            if (j === idx || !this.isRipe(j)) continue;
            if (this.swipe) this.swipe.hits.add(j);
            this.harvest(j, this.nextCombo(), 'chain');
          }
          break;
        case 'spore':
          for (let j = 0; j < this.slots; j++) {
            if (j !== idx && !f[j].m) this.sprout(f[j], j, 0.35);
          }
          break;
        case 'frenzy':
          s.frenzy = Math.min(60, s.frenzy + D.FRENZY_TIME);
          break;
      }
    }

    beginSwipe() { this.swipe = { combo: 0, total: 0, hits: new Set() }; }

    swipeHit(i) {
      if (!this.swipe) this.beginSwipe();
      const sw = this.swipe;
      if (sw.hits.has(i) || !this.isRipe(i)) return 0;
      sw.hits.add(i);
      const m = this.field()[i].m;
      if (m.hp > 1) return this.harvest(i, 0, 'swipe');
      const v = this.harvest(i, ++sw.combo, 'swipe');
      sw.total += v;
      return v;
    }

    endSwipe() {
      const sw = this.swipe;
      this.swipe = null;
      if (!sw) return;
      if (sw.combo > this.s.stats.bestCombo) this.s.stats.bestCombo = sw.combo;
      if (sw.combo >= 2) this.emit({ type: 'combo', n: sw.combo, bonus: 1 + this.comboStep * (sw.combo - 1) });
    }

    autoHarvest(n) {
      const ripe = [];
      for (let j = 0; j < this.slots; j++) if (this.isRipe(j)) ripe.push(j);
      for (let k = 0; k < n && ripe.length; k++) {
        const pick = Math.floor(this.rng() * ripe.length);
        const j = ripe[pick];
        if (!this.isRipe(j)) { ripe.splice(pick, 1); k--; continue; } // 연쇄 수확 등으로 이미 사라짐
        this.emit({ type: 'snail', idx: j });
        this.harvest(j, 1, 'snail');
        if (!this.isRipe(j)) ripe.splice(pick, 1);
      }
    }

    earn(v, auto) {
      const s = this.s;
      s.spores += v;
      s.runEarned += v;
      s.lifetimeEarned += v;
      this.income.push([this.clock, v, auto]);
      this.incomeSum += v;
      if (auto) this.autoIncomeSum += v;
    }

    emit(e) { if (!this.silent) this.events.push(e); }

    // ── 강화 구매 ────────────────────────────────────────────────
    cost(u, from, n) {
      const g = u.growth;
      const first = u.base * Math.pow(g, from);
      if (g === 1) return first * n;
      return first * (Math.pow(g, n) - 1) / (g - 1);
    }

    affordable(u, from, budget) {
      const g = u.growth;
      const first = u.base * Math.pow(g, from);
      if (budget < first) return 0;
      if (g === 1) return Math.floor(budget / first);
      return Math.floor(Math.log(budget * (g - 1) / first + 1) / Math.log(g));
    }

    // amount: 1 | 10 | 'max' → 구매할 수량과 비용
    quote(id, amount) {
      const u = D.UP[id];
      const from = this.lvl(id);
      const room = this.maxLevel(u) - from;
      if (room <= 0) return { n: 0, cost: Infinity, maxed: true };
      let n;
      if (amount === 'max') n = Math.max(1, Math.min(room, this.affordable(u, from, this.s.spores)));
      else n = Math.min(amount, room);
      return { n, cost: this.cost(u, from, n), maxed: false };
    }

    buy(id, amount) {
      const q = this.quote(id, amount);
      if (q.maxed || q.n <= 0 || this.s.spores < q.cost) return false;
      this.s.spores -= q.cost;
      this.s.upgrades[id] = this.lvl(id) + q.n;
      this.recalc();
      this.emit({ type: 'buy', id, n: q.n });
      return true;
    }

    pQuote(id) {
      const u = D.PUP[id];
      const l = this.plvl(id);
      if (l >= u.max) return { cost: Infinity, maxed: true };
      return { cost: Math.ceil(u.base * Math.pow(u.growth, l)), maxed: false };
    }

    pBuy(id) {
      const q = this.pQuote(id);
      if (q.maxed || this.s.mycelium < q.cost) return false;
      this.s.mycelium -= q.cost;
      this.s.pUpgrades[id] = this.plvl(id) + 1;
      if (id === 'p_auto') this.s.nutrient = this.cap;
      this.recalc();
      this.emit({ type: 'pbuy', id });
      return true;
    }

    // ── 원목 ─────────────────────────────────────────────────────
    nextLockedLog() {
      return D.LOGS.find(l => !this.s.logsUnlocked.includes(l.id)) || null;
    }

    unlockLog(id) {
      const next = this.nextLockedLog();
      if (!next || next.id !== id || this.s.spores < next.cost) return false;
      this.s.spores -= next.cost;
      this.s.logsUnlocked.push(id);
      this.switchLog(id);
      this.emit({ type: 'unlockLog', id });
      return true;
    }

    switchLog(id) {
      if (!this.s.logsUnlocked.includes(id) || this.s.currentLog === id) return false;
      this.s.currentLog = id;
      this.snailTimer = 0;
      this.emit({ type: 'switchLog', id });
      return true;
    }

    // ── 환생 (포자 방출) ──────────────────────────────────────────
    myceliumGain() {
      return Math.floor(Math.cbrt(this.s.runEarned / D.PRESTIGE_BASE));
    }

    nextMyceliumAt() {
      const g = this.myceliumGain() + 1;
      return g * g * g * D.PRESTIGE_BASE;
    }

    prestige() {
      const gain = this.myceliumGain();
      if (gain < 1) return 0;
      const s = this.s;
      s.mycelium += gain;
      s.myceliumTotal += gain;
      s.prestiges++;
      s.spores = 0;
      s.runEarned = 0;
      s.upgrades = {};
      s.frenzy = 0;
      if (!this.plvl('p_keep')) {
        s.logsUnlocked = ['oak'];
        s.currentLog = 'oak';
      }
      this.fields = {};
      this.snailTimer = 0;
      this.income = []; this.incomeSum = 0; this.autoIncomeSum = 0;
      this.recalc();
      s.nutrient = Math.min(this.cap, 12);
      this.emit({ type: 'prestige', gain });
      return gain;
    }

    // ── 오프라인 진행 ────────────────────────────────────────────
    applyOffline(seconds) {
      if (!(seconds > 10)) return null;
      const secs = Math.min(seconds, D.OFFLINE_CAP);
      const s = this.s;
      const before = s.runEarned;
      this.silent = true;
      const step = Math.max(0.5, secs / 6000);
      for (let t = 0; t < secs; t += step) this.tick(Math.min(step, secs - t));
      this.silent = false;
      this.events.length = 0;
      this.income = []; this.incomeSum = 0; this.autoIncomeSum = 0; this.clock = 0;
      const earned = s.runEarned - before;
      const eff = D.PUP.p_offline.val(this.plvl('p_offline'));
      const cut = earned * (1 - eff);
      s.spores -= cut; s.runEarned -= cut; s.lifetimeEarned -= cut;
      return { secs, earned: earned - cut };
    }

    // ── 저장 ─────────────────────────────────────────────────────
    serialize() {
      const o = JSON.parse(JSON.stringify(this.s));
      o.lastTick = Date.now();
      o.fields = {};
      for (const id in this.fields) {
        o.fields[id] = this.fields[id].map(sl => sl.m ? [sl.m.sp, Math.round(sl.m.g * 1000) / 1000, sl.m.hp] : 0);
      }
      return o;
    }

    loadFields(fs) {
      for (const id in fs) {
        if (!D.LOG[id] || !Array.isArray(fs[id])) continue;
        const f = this.field(id);
        fs[id].forEach((e, i) => {
          if (i < f.length && Array.isArray(e) && D.SP[e[0]]) {
            f[i].m = { sp: e[0], g: Math.min(1, +e[1] || 0), hp: e[2] || 1, ph: this.rng() * 6.283, hit: 0 };
          }
        });
      }
    }
  }

  MG.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
