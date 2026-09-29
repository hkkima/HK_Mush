// 게임 로직 테스트: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
for (const f of ['format.js', 'data.js', 'game.js']) require(path.join(__dirname, '..', 'js', f));
const MG = globalThis.MG;
const D = MG.DATA;

function seeded(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

function ripenAll(game) {
  game.s.nutrient = game.cap;
  for (let i = 0; i < 400; i++) game.tick(0.1);
}

test('데이터 무결성: 모든 원목에 5종, 모든 종에 유효한 원목·희귀도', () => {
  for (const L of D.LOGS) assert.strictEqual(D.POOL[L.id].length, 5, L.id);
  for (const sp of D.SPECIES) {
    assert.ok(D.LOG[sp.log], sp.id);
    assert.ok(D.RARITY[sp.rarity], sp.id);
    if (sp.effect) assert.ok(D.EFFECTS[sp.effect], sp.id);
  }
  assert.strictEqual(new Set(D.SLOT_POS.map(p => p.u.toFixed(3) + p.v)).size, D.MAX_SLOTS);
});

test('영양이 있으면 버섯이 자라고, 그어서 수확하면 포자를 번다', () => {
  const g = new MG.Game(null, seeded(1));
  ripenAll(g);
  const ripe = [...Array(g.slots).keys()].filter(i => g.isRipe(i));
  assert.ok(ripe.length > 0);
  g.beginSwipe();
  ripe.forEach(i => g.swipeHit(i));
  g.endSwipe();
  assert.ok(g.s.spores > 0);
  assert.ok(g.s.stats.harvested >= 1);
  assert.ok(g.s.species.nameko || g.s.species.oyster || g.s.species.enoki);
});

test('덜 자란 버섯은 수확되지 않는다', () => {
  const g = new MG.Game(null, seeded(2));
  g.s.nutrient = g.cap;
  const f = g.field();
  f[0].m = { sp: 'nameko', g: 0.5, hp: 1, ph: 0, hit: 0 };
  assert.strictEqual(g.harvest(0, 1, 'swipe'), 0);
  assert.ok(f[0].m);
});

test('거대 버섯은 hp만큼 그어야 수확된다', () => {
  const g = new MG.Game(null, seeded(3));
  const f = g.field();
  f[0].m = { sp: 'giant', g: 1, hp: 4, ph: 0, hit: 0 };
  for (let k = 0; k < 3; k++) {
    g.beginSwipe(); g.swipeHit(0); g.endSwipe();
    assert.ok(f[0].m, 'hit ' + k);
  }
  g.beginSwipe(); g.swipeHit(0); g.endSwipe();
  assert.strictEqual(f[0].m, null);
  assert.ok(g.s.spores > 0);
});

test('영양이 없으면 성장이 크게 느려진다', () => {
  const wet = new MG.Game(null, seeded(4));
  const dry = new MG.Game(null, seeded(4));
  for (const g of [wet, dry]) g.field()[0].m = { sp: 'nameko', g: 0, hp: 1, ph: 0, hit: 0 };
  wet.s.nutrient = 1e9; wet.cap = 1e9;
  dry.s.nutrient = 0;
  for (let i = 0; i < 20; i++) { wet.tick(0.1); dry.tick(0.1); }
  assert.ok(wet.field()[0].m.g > dry.field()[0].m.g * 3);
});

test('연속 베기: 한 번에 여러 개를 베면 콤보 보너스', () => {
  const g = new MG.Game(null, seeded(5));
  g.s.species.nameko = { count: 1 }; g.recalc();
  const f = g.field();
  for (let i = 0; i < 3; i++) f[i].m = { sp: 'nameko', g: 1, hp: 1, ph: 0, hit: 0 };
  const single = g.valueOf(D.SP.nameko);
  g.beginSwipe();
  const vals = [0, 1, 2].map(i => g.swipeHit(i));
  g.endSwipe();
  assert.ok(Math.abs(vals[0] - single) < 1e-9 || vals[0] >= single * D.CRIT_MULT * 0.99);
  assert.ok(g.events.some(e => e.type === 'combo' && e.n === 3));
});

test('강화 구매: 비용 차감, 레벨 증가, 최대치 제한', () => {
  const g = new MG.Game(null, seeded(6));
  g.s.spores = 1e30;
  assert.ok(g.buy('slots', 'max'));
  assert.strictEqual(g.slots, D.MAX_SLOTS);
  assert.ok(!g.buy('slots', 1));
  g.s.spores = 1e6;
  const before = g.s.spores;
  assert.ok(g.buy('value', 10));
  assert.strictEqual(g.lvl('value'), 10);
  assert.ok(g.s.spores < before);
});

test('원목은 순서대로 해금된다', () => {
  const g = new MG.Game(null, seeded(7));
  g.s.spores = 1e40;
  assert.ok(!g.unlockLog('moss'));
  assert.ok(g.unlockLog('birch'));
  assert.strictEqual(g.s.currentLog, 'birch');
  assert.ok(g.switchLog('oak'));
  assert.strictEqual(g.s.currentLog, 'oak');
});

test('환생: 균사 획득, 진행 초기화, 도감 유지', () => {
  const g = new MG.Game(null, seeded(8));
  g.s.species.nameko = { count: 50 };
  g.s.runEarned = 1e12;
  g.s.spores = 5e11;
  g.s.upgrades.value = 20;
  g.s.logsUnlocked.push('birch');
  const gain = g.prestige();
  assert.strictEqual(gain, 100); // ∛(1e12 / 1e6)
  assert.strictEqual(g.s.spores, 0);
  assert.strictEqual(g.lvl('value'), 0);
  assert.deepStrictEqual(g.s.logsUnlocked, ['oak']);
  assert.strictEqual(g.s.species.nameko.count, 50);
  assert.ok(g.myceliumMult > 1);
});

test('저장 → 불러오기 왕복', () => {
  const g = new MG.Game(null, seeded(9));
  ripenAll(g);
  g.s.spores = 1234;
  g.s.upgrades.growth = 3;
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const h = new MG.Game(data, seeded(10));
  assert.strictEqual(h.s.spores, 1234);
  assert.strictEqual(h.lvl('growth'), 3);
  const ripeA = [...Array(g.slots).keys()].filter(i => g.isRipe(i)).length;
  const ripeB = [...Array(h.slots).keys()].filter(i => h.isRipe(i)).length;
  assert.strictEqual(ripeA, ripeB);
});

test('오프라인 진행: 달팽이가 있으면 포자를 번다 (효율 적용)', () => {
  const g = new MG.Game(null, seeded(11));
  g.s.upgrades.snail = 5; g.s.upgrades.auto = 5; g.s.upgrades.slots = 10;
  g.recalc();
  const res = g.applyOffline(3600);
  assert.ok(res.earned > 0);
  assert.strictEqual(g.events.length, 0);
});

test('숫자 표기', () => {
  assert.strictEqual(MG.fmt(0), '0');
  assert.strictEqual(MG.fmt(999), '999');
  assert.strictEqual(MG.fmt(1500), '1.50K');
  assert.strictEqual(MG.fmt(2.5e9), '2.50B');
  assert.match(MG.fmt(1e80), /e80$/);
});

test('긴 시뮬레이션에서도 수치가 유한하다 (폭주 방지)', () => {
  const g = new MG.Game(null, seeded(12));
  g.s.spores = 1e60;
  for (const u of D.UPGRADES) g.buy(u.id, 'max');
  for (const L of D.LOGS) g.unlockLog(L.id);
  for (let i = 0; i < 3000; i++) {
    g.tick(0.1);
    g.autoHarvest(5);
  }
  assert.ok(Number.isFinite(g.s.spores));
  assert.ok(Number.isFinite(g.rate()));
});
