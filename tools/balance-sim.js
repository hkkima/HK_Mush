// 밸런스 시뮬레이터: node tools/balance-sim.js [플레이 시간(시간)=6] [seed=1]
// "적당히 부지런한 플레이어" 봇이 플레이하며 주요 이정표 도달 시각을 출력한다.
// 환경변수: EVERY=초 (상태 출력 간격, 기본 900) · NOPRESTIGE=1 (환생 안 함) · VERBOSE=1 (강화 레벨 출력)
'use strict';
const path = require('path');
for (const f of ['format.js', 'data.js', 'game.js']) require(path.join(__dirname, '..', 'js', f));
const MG = globalThis.MG;
const D = MG.DATA;

const hours = +(process.argv[2] || 6);
let seed = +(process.argv[3] || 1);
const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const game = new MG.Game(null, rng);
const DT = 0.1;
const EVERY = +(process.env.EVERY || 900);
const NOPRESTIGE = !!process.env.NOPRESTIGE;
const VERBOSE = !!process.env.VERBOSE;
const END = hours * 3600;

// 봇 행동 파라미터
const TAPS_PER_SEC = 3;       // 영양제 탭
const SWIPE_EVERY = 0.8;      // 몇 초마다 한 번 긋는지
const SWIPE_MAX = 6;          // 한 번 그을 때 최대 몇 개
const PRIORITY = ['slots', 'value', 'growth', 'spray', 'tank', 'auto', 'combo', 'regen', 'snail', 'luck', 'crit'];

const log = [];
const note = (t, msg) => log.push(`[${MG.fmtTime(t).padStart(10)}] ${msg}`);
let tapAcc = 0, swipeAcc = 0, buyAcc = 0, lastRun = 0;
let prestigedAt = 0;

for (let t = 0; t < END; t += DT) {
  game.tick(DT);

  tapAcc += DT * TAPS_PER_SEC;
  while (tapAcc >= 1) {
    tapAcc--;
    if (game.s.nutrient < game.cap * 0.9 || rng() < 0.5) {
      const near = [];
      const c = Math.floor(rng() * game.slots);
      for (let i = 0; i < game.slots; i++) if (Math.abs(D.SLOT_POS[i].u - D.SLOT_POS[c].u) < 0.12) near.push(i);
      game.spray(near);
    }
  }

  swipeAcc += DT;
  if (swipeAcc >= SWIPE_EVERY) {
    swipeAcc = 0;
    game.beginSwipe();
    let n = 0;
    for (let i = 0; i < game.slots && n < SWIPE_MAX; i++) if (game.isRipe(i)) { game.swipeHit(i); n++; }
    game.endSwipe();
  }

  for (const e of game.events) {
    if (e.type === 'discover') note(t, `발견: ${D.SP[e.sp].name} (${D.RARITY[D.SP[e.sp].rarity].name})`);
  }
  game.events.length = 0;

  buyAcc += DT;
  if (buyAcc >= 1) {
    buyAcc = 0;
    // 원목 해금 우선
    const next = game.nextLockedLog();
    if (next && game.s.spores >= next.cost) {
      game.unlockLog(next.id);
      note(t, `원목 해금: ${next.name}  (수입 ${MG.fmt(game.rate())}/초)`);
    }
    // 가장 싼 강화부터 (우선순위 순서로 동률 처리)
    for (let guard = 0; guard < 50; guard++) {
      let best = null, bestCost = Infinity;
      for (const id of PRIORITY) {
        const q = game.quote(id, 1);
        if (q.maxed) continue;
        const w = id === 'value' || id === 'growth' ? 0.7 : 1;
        if (q.cost * w < bestCost) { bestCost = q.cost * w; best = id; }
      }
      if (!best || !game.buy(best, 1)) break;
    }
    // 환생: 현재 균사의 2배 이상 얻을 수 있고 런 시간이 충분할 때
    const gain = NOPRESTIGE ? 0 : game.myceliumGain();
    const runT = t - prestigedAt;
    if (gain >= Math.max(3, game.s.myceliumTotal * 1.5) && runT > 600 && !next) {
      doPrestige(t, gain);
    } else if (gain >= Math.max(3, game.s.myceliumTotal) && runT > 900 && next && game.s.spores < next.cost / 20) {
      doPrestige(t, gain);
    }
  }

  if (t - lastRun >= EVERY) {
    lastRun = t;
    const s = game.s;
    note(t, `수입 ${MG.fmt(game.rate())}/초 · 포자 ${MG.fmt(s.spores)} · 원목 ${s.currentLog} · 자리 ${game.slots} · 성장×${MG.fmtMult(game.growthMult)} · 가치×${MG.fmt(game.valueMult)} · 균사 ${s.myceliumTotal} · 도감 ${game.discovered}/${D.SPECIES.length} · 콜렉션×${MG.fmtMult(game.collectionMult)} · 스타 ${game.totalStars} ${VERBOSE ? JSON.stringify(s.upgrades) : ''}`);
  }
}

function doPrestige(t, gain) {
  // 균사 상점: 싼 것부터
  game.prestige();
  prestigedAt = t;
  for (let guard = 0; guard < 100; guard++) {
    let best = null, bestCost = Infinity;
    for (const u of D.PUPGRADES) {
      const q = game.pQuote(u.id);
      if (!q.maxed && q.cost < bestCost && q.cost <= game.s.mycelium) { best = u.id; bestCost = q.cost; }
    }
    if (!best) break;
    game.pBuy(best);
  }
  note(t, `🧬 환생 #${game.s.prestiges}: 균사 +${gain} (총 ${game.s.myceliumTotal})  강화: ${JSON.stringify(game.s.pUpgrades)}`);
}

console.log(log.join('\n'));
const s = game.s;
console.log('\n=== 최종 ===');
console.log(`누적 포자 ${MG.fmt(s.lifetimeEarned)}, 수확 ${s.stats.harvested}, 최고 콤보 ${s.stats.bestCombo}, 도감 ${game.discovered}/${D.SPECIES.length}`);
console.log('강화:', JSON.stringify(s.upgrades));
