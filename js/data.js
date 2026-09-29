// 게임 데이터 정의: 희귀도, 원목(스테이지), 버섯 종, 강화, 균사(환생) 강화
(function (G) {
  'use strict';
  const MG = G.MG = G.MG || {};
  const D = MG.DATA = {};

  D.MAX_SLOTS = 30;
  D.NUTRIENT_DRAIN = 1;        // 초당 영양 소모량
  D.DROUGHT = 0.15;            // 영양이 없을 때 성장 배율
  D.FRENZY_MULT = 3;           // 버섯 축제 배율 (가치·성장)
  D.FRENZY_TIME = 15;
  D.CRIT_MULT = 10;
  D.PRESTIGE_BASE = 1e6;       // 균사 = ∛(이번 회차 누적 포자 / PRESTIGE_BASE)
  D.MYC_BONUS = 0.1;           // 가치 배율 = 1 + MYC_BONUS × √(누적 균사)
  D.OFFLINE_EFF = 0.5;
  D.OFFLINE_CAP = 8 * 3600;
  D.STAR_THRESHOLDS = [10, 100, 1000, 10000, 100000];
  D.STAR_MULT = 1.6;           // 별 하나당 해당 버섯 가치 배율

  D.RARITY = {
    common:   { name: '일반', color: '#a38f75', weight: 1000, tier: 0, growMul: 1 },
    uncommon: { name: '고급', color: '#5fae57', weight: 220,  tier: 1, growMul: 1.3 },
    rare:     { name: '희귀', color: '#3b8fd9', weight: 45,   tier: 2, growMul: 1.7 },
    epic:     { name: '영웅', color: '#9b59d0', weight: 9,    tier: 3, growMul: 2.2 },
    legend:   { name: '전설', color: '#e0a01b', weight: 1.5,  tier: 4, growMul: 3 },
  };

  D.EFFECTS = {
    nutrient: { icon: '💧', name: '영양 충전', desc: '수확하면 영양 탱크가 가득 찹니다.' },
    time:     { icon: '⏰', name: '시간 가속', desc: '수확하면 자라는 버섯이 모두 50% 더 자랍니다.' },
    chain:    { icon: '⚡', name: '연쇄 수확', desc: '수확하면 다 자란 버섯을 모두 함께 수확합니다.' },
    spore:    { icon: '🌫️', name: '포자 폭발', desc: '수확하면 빈 자리마다 새싹이 돋아납니다.' },
    frenzy:   { icon: '🎉', name: '버섯 축제', desc: '수확하면 15초간 가치·성장 ×3.' },
  };

  // ── 원목 (스테이지) ─────────────────────────────────────────────
  D.LOGS = [
    { id: 'oak', name: '참나무 원목', cost: 0, base: 1, growTime: 6,
      desc: '모든 버섯 농부의 첫 원목. 촉촉하고 튼튼하다.',
      theme: { sky: ['#a8d8c8', '#eef5d8'], far: '#79a88a', ground: '#5d8f4b',
        bark: '#7a5230', barkD: '#4e321b', barkL: '#a3714a', ring: '#e2bb82', ringD: '#b88a52' } },
    { id: 'birch', name: '자작나무 원목', cost: 1e3, base: 10, growTime: 9,
      desc: '하얀 껍질에 까만 무늬. 향긋한 버섯이 잘 자란다.',
      theme: { sky: ['#bfe3f2', '#f6f8e8'], far: '#93b8a4', ground: '#78a55c',
        bark: '#ece6d6', barkD: '#9d958a', barkL: '#ffffff', ring: '#f2ddb0', ringD: '#cfb07a', deco: 'birch' } },
    { id: 'moss', name: '이끼 고목', cost: 1e6, base: 150, growTime: 10,
      desc: '수백 년 쓰러져 있던 고목. 이끼 사이로 기묘한 버섯이 돋는다.',
      theme: { sky: ['#4f7a5a', '#b3cf95'], far: '#365a40', ground: '#3f6b35',
        bark: '#5a4630', barkD: '#3a2c1d', barkL: '#76603f', ring: '#b99867', ringD: '#8a6d45', deco: 'moss' } },
    { id: 'moon', name: '달빛 버드나무', cost: 5e10, base: 3e3, growTime: 11,
      desc: '보름달 아래에서만 숨을 쉬는 나무. 버섯이 은은하게 빛난다.',
      theme: { sky: ['#11163a', '#3b407e'], far: '#0d1230', ground: '#1f2550',
        bark: '#4a4562', barkD: '#2d2a40', barkL: '#6f6a92', ring: '#bcb4dc', ringD: '#8a82b0', deco: 'moon', night: true } },
    { id: 'crystal', name: '수정 동굴 뿌리', cost: 1e18, base: 8e4, growTime: 12,
      desc: '동굴 깊숙이 뻗은 뿌리. 광물을 먹고 자란 버섯은 보석처럼 단단하다.',
      theme: { sky: ['#1c0f2e', '#4a2d6b'], far: '#2a1842', ground: '#2b1c40',
        bark: '#5b4a6e', barkD: '#3a2d4a', barkL: '#7d6a94', ring: '#d9c6f0', ringD: '#a58cc6', deco: 'crystal', night: true } },
    { id: 'world', name: '세계수 가지', cost: 1e25, base: 3e6, growTime: 13,
      desc: '하늘까지 닿은 세계수에서 떨어진 가지. 생명력이 넘친다.',
      theme: { sky: ['#ffe8a8', '#cdefc2'], far: '#8cbf73', ground: '#5f9e4f',
        bark: '#8a6a3f', barkD: '#5c4527', barkL: '#b08b57', ring: '#f7df9f', ringD: '#d1b06a', deco: 'leaves' } },
    { id: 'star', name: '별빛 운석', cost: 1e33, base: 1.5e8, growTime: 14,
      desc: '밤하늘에서 떨어진 운석. 우주의 포자가 잠들어 있다.',
      theme: { sky: ['#04050e', '#1d1545'], far: '#120e2c', ground: '#161233',
        bark: '#3c3a4f', barkD: '#24222f', barkL: '#5f5c78', ring: '#ff9be0', ringD: '#8a5cff', deco: 'stars', night: true } },
  ];

  // ── 버섯 종 ────────────────────────────────────────────────────
  // look: shape(round|wide|bell|flat|tall|puff|crystal|star), cap/cap2/stem 색, pattern, glow, rainbow, alpha, scale
  D.SPECIES = [
    // 참나무
    { id: 'nameko', log: 'oak', rarity: 'common', value: 1, name: '나메코',
      desc: '미끌미끌 동글동글. 모든 것의 시작.',
      look: { shape: 'round', cap: '#d9772b', cap2: '#f3a553', stem: '#f6ead0' } },
    { id: 'oyster', log: 'oak', rarity: 'uncommon', value: 3, name: '느타리',
      desc: '부채처럼 펼쳐진 갓. 어디서든 잘 자란다.',
      look: { shape: 'flat', cap: '#8e959f', cap2: '#c9ced5', stem: '#ece7dc' } },
    { id: 'enoki', log: 'oak', rarity: 'rare', value: 10, name: '팽이',
      desc: '셋이 꼭 붙어 다니는 가느다란 삼총사.',
      look: { shape: 'tall', cap: '#efe6cc', cap2: '#fffaf0', stem: '#f4ecd6' } },
    { id: 'dew', log: 'oak', rarity: 'epic', value: 30, name: '이슬 버섯', effect: 'nutrient',
      desc: '갓에 아침 이슬을 가득 머금고 있다.',
      look: { shape: 'round', cap: '#58b9e0', cap2: '#b6ecff', stem: '#e9f7fb', pattern: 'dots', spots: '#e8fbff', glow: '#8fe3ff' } },
    { id: 'golden', log: 'oak', rarity: 'legend', value: 150, name: '황금 나메코',
      desc: '전설로만 전해지던 금빛 나메코. 반짝반짝!',
      look: { shape: 'round', cap: '#eaa51d', cap2: '#ffe07a', stem: '#fff1c1', glow: '#ffd84d', pattern: 'shine' } },

    // 자작나무
    { id: 'shiitake', log: 'birch', rarity: 'common', value: 1, name: '표고',
      desc: '갈라진 무늬가 멋진 향긋한 버섯.',
      look: { shape: 'wide', cap: '#7b4a2a', cap2: '#a8704a', stem: '#f1e3c6', pattern: 'cracks', spots: '#f4e2c4' } },
    { id: 'chanterelle', log: 'birch', rarity: 'uncommon', value: 3, name: '꾀꼬리버섯',
      desc: '노란 나팔 모양. 살구 향이 난다.',
      look: { shape: 'bell', cap: '#eba61e', cap2: '#ffd46b', stem: '#f7d77e' } },
    { id: 'clock', log: 'birch', rarity: 'rare', value: 10, name: '시계 버섯', effect: 'time',
      desc: '째깍째깍. 주변의 시간을 빨리 감는다.',
      look: { shape: 'wide', cap: '#2fa895', cap2: '#8de0cf', stem: '#e6f5ef', pattern: 'clock', spots: '#fdfbf0' } },
    { id: 'lightning', log: 'birch', rarity: 'epic', value: 30, name: '번개 버섯', effect: 'chain',
      desc: '찌릿! 건드리면 원목 전체에 전기가 흐른다.',
      look: { shape: 'bell', cap: '#ffc81f', cap2: '#fff07a', stem: '#46465f', pattern: 'zigzag', spots: '#3b3b58', glow: '#fff27a' } },
    { id: 'giant', log: 'birch', rarity: 'legend', value: 200, name: '왕나메코', hp: 4,
      desc: '너무 커서 네 번은 그어야 수확된다.',
      look: { shape: 'round', cap: '#b5452f', cap2: '#e87a57', stem: '#f4e5cc', pattern: 'spots', spots: '#fff3e0', scale: 1.55 } },

    // 이끼 고목
    { id: 'mossy', log: 'moss', rarity: 'common', value: 1, name: '이끼송이',
      desc: '초록 갓 위에 작은 이끼가 자란다.',
      look: { shape: 'round', cap: '#5f9a3a', cap2: '#96cb62', stem: '#e5ecd0', pattern: 'spots', spots: '#c4e892' } },
    { id: 'flyagaric', log: 'moss', rarity: 'uncommon', value: 3, name: '광대버섯',
      desc: '빨간 갓에 하얀 점. 동화책의 그 버섯.',
      look: { shape: 'wide', cap: '#d8322b', cap2: '#ff6a55', stem: '#fbf5e8', pattern: 'spots', spots: '#ffffff' } },
    { id: 'puffball', log: 'moss', rarity: 'rare', value: 10, name: '말불버섯', effect: 'spore',
      desc: '톡 건드리면 퍼엉! 포자 구름이 퍼진다.',
      look: { shape: 'puff', cap: '#e2d3b5', cap2: '#fff6e4', stem: '#e2d3b5', pattern: 'dots', spots: '#cbb78f' } },
    { id: 'ghost', log: 'moss', rarity: 'epic', value: 30, name: '유령 버섯', effect: 'time',
      desc: '반쯤 투명하다. 가끔 혼자 사라졌다 나타난다.',
      look: { shape: 'bell', cap: '#dfe5ff', cap2: '#ffffff', stem: '#e8ecff', glow: '#cfd8ff', alpha: 0.72 } },
    { id: 'festival', log: 'moss', rarity: 'legend', value: 250, name: '축제 버섯', effect: 'frenzy',
      desc: '이 버섯이 뜨면 숲 전체가 들썩인다!',
      look: { shape: 'round', rainbow: true, stem: '#fffaf0', pattern: 'spots', spots: '#ffffff', glow: '#ffffff' } },

    // 달빛 버드나무
    { id: 'moonshade', log: 'moon', rarity: 'common', value: 1, name: '달그늘 버섯',
      desc: '달빛 그늘에서 몽글몽글 자란다.',
      look: { shape: 'round', cap: '#4b4fa8', cap2: '#8589e6', stem: '#d9dcf5', pattern: 'stars', spots: '#fff9d6', glow: '#8c92ff' } },
    { id: 'lantern', log: 'moon', rarity: 'uncommon', value: 3, name: '초롱 버섯',
      desc: '밤길을 비춰주는 다정한 버섯.',
      look: { shape: 'bell', cap: '#ff8a3c', cap2: '#ffcf85', stem: '#ffe9c9', glow: '#ffb35c' } },
    { id: 'mirror', log: 'moon', rarity: 'rare', value: 12, name: '거울 버섯', effect: 'nutrient',
      desc: '갓에 비친 달을 마시며 자란다.',
      look: { shape: 'wide', cap: '#b9c3d0', cap2: '#ffffff', stem: '#e7ecf2', glow: '#ffffff', pattern: 'shine' } },
    { id: 'nightcap', log: 'moon', rarity: 'epic', value: 35, name: '밤망토 버섯', effect: 'chain',
      desc: '셋이 모여 밤하늘에 번개를 부른다.',
      look: { shape: 'tall', cap: '#3a2d6a', cap2: '#7a64c8', stem: '#b9b0dd', glow: '#a58cff' } },
    { id: 'fullmoon', log: 'moon', rarity: 'legend', value: 300, name: '보름달 버섯', effect: 'frenzy',
      desc: '둥실 떠오른 작은 보름달.',
      look: { shape: 'puff', cap: '#ffeaa0', cap2: '#fffdf0', stem: '#fff9e3', glow: '#fff2a8', pattern: 'dots', spots: '#f0d98a', scale: 1.3 } },

    // 수정 동굴
    { id: 'quartz', log: 'crystal', rarity: 'common', value: 1, name: '석영 버섯',
      desc: '딱딱하지만 속은 말랑하다.',
      look: { shape: 'crystal', cap: '#b9cde0', cap2: '#ffffff', stem: '#c4d3e0' } },
    { id: 'amethyst', log: 'crystal', rarity: 'uncommon', value: 3, name: '자수정 버섯',
      desc: '보랏빛으로 빛나는 귀한 버섯.',
      look: { shape: 'crystal', cap: '#8e4cc8', cap2: '#d6a8ff', stem: '#e6d5f5', glow: '#c48cff' } },
    { id: 'ember', log: 'crystal', rarity: 'rare', value: 12, name: '불꽃 버섯', effect: 'chain',
      desc: '뜨거워서 만지면 옆으로 불이 옮겨 붙는다.',
      look: { shape: 'bell', cap: '#ff5a1f', cap2: '#ffc04d', stem: '#5a2a1a', glow: '#ff7a2f', pattern: 'zigzag', spots: '#fff0a0' } },
    { id: 'frost', log: 'crystal', rarity: 'epic', value: 40, name: '서리 버섯', effect: 'nutrient',
      desc: '녹으면서 차가운 영양수를 흘린다.',
      look: { shape: 'crystal', cap: '#7fcff5', cap2: '#eafaff', stem: '#dff4ff', glow: '#bfeaff' } },
    { id: 'prism', log: 'crystal', rarity: 'legend', value: 350, name: '프리즘 버섯', effect: 'frenzy',
      desc: '빛을 일곱 갈래로 쪼갠다.',
      look: { shape: 'crystal', rainbow: true, stem: '#f3f0ff', glow: '#ffffff', scale: 1.3 } },

    // 세계수
    { id: 'sproutling', log: 'world', rarity: 'common', value: 1, name: '새싹 버섯',
      desc: '세계수의 생명력을 받아 쑥쑥 자란다.',
      look: { shape: 'round', cap: '#8fcf4f', cap2: '#cff290', stem: '#f3f7dc', pattern: 'dots', spots: '#effdc8' } },
    { id: 'elder', log: 'world', rarity: 'uncommon', value: 3, name: '고목령 버섯',
      desc: '나이테를 품은 지혜로운 버섯.',
      look: { shape: 'wide', cap: '#6b4b2e', cap2: '#a57b4f', stem: '#d9c8a4', pattern: 'rings', spots: '#e5c796' } },
    { id: 'phoenix', log: 'world', rarity: 'rare', value: 15, name: '불사조 버섯', effect: 'spore',
      desc: '수확해도 그 자리에 다시 태어난다.',
      look: { shape: 'bell', cap: '#ff4d3a', cap2: '#ffd24a', stem: '#fff0cc', glow: '#ff8a3c', pattern: 'shine' } },
    { id: 'sage', log: 'world', rarity: 'epic', value: 50, name: '현자 버섯', effect: 'time',
      desc: '천 년을 하루처럼 사는 버섯.',
      look: { shape: 'tall', cap: '#2f8f6a', cap2: '#8fe0bb', stem: '#eef7ef', glow: '#a7ffd9' } },
    { id: 'yggdra', log: 'world', rarity: 'legend', value: 450, name: '세계수 버섯', hp: 6, effect: 'spore',
      desc: '거대하다. 여섯 번은 그어야 한다.',
      look: { shape: 'round', cap: '#2f9e5a', cap2: '#8ee894', stem: '#f5edd2', pattern: 'spots', spots: '#fff9c9', glow: '#d6ffb0', scale: 1.7 } },

    // 별빛 운석
    { id: 'stardust', log: 'star', rarity: 'common', value: 1, name: '별가루 버섯',
      desc: '갓이 별 모양으로 굳었다.',
      look: { shape: 'star', cap: '#3a4690', cap2: '#6f7fe0', stem: '#cfd6ff', pattern: 'stars', spots: '#fff7c0', glow: '#8b9bff' } },
    { id: 'comet', log: 'star', rarity: 'uncommon', value: 3, name: '혜성 버섯',
      desc: '긴 꼬리를 그리며 자란다.',
      look: { shape: 'bell', cap: '#4fc4ff', cap2: '#dff6ff', stem: '#e8f4ff', glow: '#9fe2ff', pattern: 'shine' } },
    { id: 'nebula', log: 'star', rarity: 'rare', value: 15, name: '성운 버섯', effect: 'chain',
      desc: '갓 속에 작은 은하가 소용돌이친다.',
      look: { shape: 'puff', cap: '#a33fd0', cap2: '#ff8ae0', stem: '#f2d6ff', glow: '#e07aff', pattern: 'stars', spots: '#ffffff' } },
    { id: 'blackhole', log: 'star', rarity: 'epic', value: 60, name: '블랙홀 버섯', effect: 'spore',
      desc: '모든 것을 빨아들였다가… 포자로 뱉는다.',
      look: { shape: 'round', cap: '#141222', cap2: '#44336e', stem: '#6b5a8f', glow: '#8a5cff', pattern: 'stars', spots: '#c9b6ff' } },
    { id: 'cosmos', log: 'star', rarity: 'legend', value: 600, name: '코스모스 버섯', hp: 5, effect: 'frenzy',
      desc: '우주 그 자체. 다섯 번 그어서 수확.',
      look: { shape: 'star', rainbow: true, stem: '#f6f0ff', glow: '#ffffff', pattern: 'stars', spots: '#ffffff', scale: 1.6 } },
  ];

  // ── 강화 (포자로 구매) ──────────────────────────────────────────
  // val(l): 해당 레벨의 효과 값, fmt(v): 표시 문자열
  D.UPGRADES = [
    { id: 'slots', icon: '🪵', name: '버섯 자리', base: 10, growth: 1.9, max: 27,
      desc: '원목에 버섯이 자랄 자리가 늘어납니다.',
      val: l => 3 + l, fmt: v => v + '칸' },
    { id: 'spray', icon: '💦', name: '영양제 농도', base: 15, growth: 1.5, max: 50,
      desc: '한 번 뿌릴 때 채워지는 영양과 근처 버섯 성장 촉진이 커집니다.',
      val: l => 3 + l * 1.5, fmt: v => '+' + v.toFixed(1) + '초' },
    { id: 'growth', icon: '🌱', name: '성장 촉진제', base: 40, growth: 1.9, max: 80,
      desc: '모든 버섯이 더 빨리 자랍니다. (레벨당 ×1.12)',
      val: l => Math.pow(1.12, l), fmt: v => '×' + MG.fmtMult(v) },
    { id: 'value', icon: '🧬', name: '품종 개량', base: 50, growth: 1.9,
      desc: '모든 버섯의 수확 가치가 오릅니다. (레벨당 ×1.18)',
      val: l => Math.pow(1.18, l), fmt: v => '×' + MG.fmtMult(v) },
    { id: 'tank', icon: '🛢️', name: '영양 탱크', base: 80, growth: 1.7, max: 40,
      desc: '영양을 더 많이 저장할 수 있습니다.',
      val: l => 20 + l * 15, fmt: v => v + '초' },
    { id: 'combo', icon: '🔪', name: '연속 베기', base: 150, growth: 2, max: 30,
      desc: '한 번 그을 때 여러 개를 베면 추가 보너스.',
      val: l => 0.05 + l * 0.02, fmt: v => '개당 +' + Math.round(v * 100) + '%' },
    { id: 'auto', icon: '🚿', name: '자동 분무기', base: 400, growth: 2.1, max: 12,
      desc: '자동으로 영양제를 뿌려줍니다. (소모량 초당 1)',
      val: l => l * 0.35, fmt: v => '초당 ' + v.toFixed(2) },
    { id: 'regen', icon: '🍄', name: '균사 재생', base: 700, growth: 1.9, max: 30,
      desc: '수확한 자리에서 새싹이 더 빨리 돋아납니다.',
      val: l => 3 * Math.pow(0.88, l), fmt: v => v.toFixed(2) + '초' },
    { id: 'luck', icon: '🍀', name: '희귀 포자', base: 1500, growth: 2.2, max: 30,
      desc: '희귀한 버섯이 더 자주 자랍니다.',
      val: l => Math.pow(1.25, l), fmt: v => '×' + MG.fmtMult(v) },
    { id: 'crit', icon: '💥', name: '대박 확률', base: 5000, growth: 2.4, max: 25,
      desc: '수확할 때 확률로 ×10 대박!',
      val: l => l * 0.02, fmt: v => Math.round(v * 100) + '%' },
    { id: 'snail', icon: '🐌', name: '수확 달팽이', base: 2.5e4, growth: 2.3, max: 40,
      desc: '달팽이가 다 자란 버섯을 대신 수확해줍니다.',
      val: l => l === 0 ? Infinity : 4 * Math.pow(0.86, l - 1), fmt: v => isFinite(v) ? v.toFixed(2) + '초마다' : '없음' },
  ];

  // ── 균사 강화 (환생 화폐로 구매) ────────────────────────────────
  D.PUPGRADES = [
    { id: 'p_value', icon: '✋', name: '황금 손길', base: 1, growth: 3, max: 80,
      desc: '모든 수확 가치 ×1.5 (레벨마다 곱연산)',
      val: l => Math.pow(1.5, l), fmt: v => '×' + MG.fmtMult(v) },
    { id: 'p_growth', icon: '🌿', name: '오래된 균사', base: 2, growth: 2.5, max: 30,
      desc: '모든 성장 속도 ×1.25',
      val: l => Math.pow(1.25, l), fmt: v => '×' + MG.fmtMult(v) },
    { id: 'p_slots', icon: '🪓', name: '넓은 원목', base: 3, growth: 3, max: 5,
      desc: '처음부터 버섯 자리 +2',
      val: l => l * 2, fmt: v => '+' + v + '칸' },
    { id: 'p_auto', icon: '♾️', name: '영원한 분무기', base: 5, growth: 1, max: 1,
      desc: '영양이 스스로 순환합니다. (자동 분무 +1.2/초)',
      val: l => l * 1.2, fmt: v => v ? '켜짐' : '꺼짐' },
    { id: 'p_luck', icon: '🌈', name: '행운의 균', base: 4, growth: 3, max: 15,
      desc: '희귀 버섯 확률 ×1.6',
      val: l => Math.pow(1.6, l), fmt: v => '×' + MG.fmtMult(v) },
    { id: 'p_snail', icon: '🐌', name: '달팽이 군단', base: 8, growth: 3.2, max: 10,
      desc: '달팽이가 한 번에 +1개 더 수확합니다.',
      val: l => 1 + l, fmt: v => v + '개씩' },
    { id: 'p_keep', icon: '🧭', name: '원목 기억', base: 25, growth: 1, max: 1,
      desc: '환생해도 해금한 원목이 유지됩니다.',
      val: l => l, fmt: v => v ? '유지' : '초기화' },
    { id: 'p_collect', icon: '📚', name: '도감 연구', base: 12, growth: 4, max: 4,
      desc: '도감 보너스 효과 +100%',
      val: l => 1 + l, fmt: v => '×' + v },
    { id: 'p_offline', icon: '💤', name: '겨울잠', base: 3, growth: 3, max: 2,
      desc: '오프라인 수익 효율 +25%',
      val: l => D.OFFLINE_EFF + l * 0.25, fmt: v => Math.round(v * 100) + '%' },
  ];

  // ── 인덱스 ──────────────────────────────────────────────────────
  D.LOG = {}; D.LOGS.forEach((l, i) => { l.index = i; D.LOG[l.id] = l; });
  D.SP = {}; D.POOL = {};
  D.SPECIES.forEach((s, i) => {
    s.index = i;
    s.hp = s.hp || 1;
    D.SP[s.id] = s;
    (D.POOL[s.log] = D.POOL[s.log] || []).push(s);
  });
  D.UP = {}; D.UPGRADES.forEach(u => { D.UP[u.id] = u; });
  D.PUP = {}; D.PUPGRADES.forEach(u => { D.PUP[u.id] = u; });

  // ── 버섯 자리 배치 (10열 × 3행, 퍼지도록 해금 순서를 섞음) ─────────
  const COL_ORDER = [4, 6, 2, 8, 0, 5, 3, 7, 1, 9];
  const ROW_ORDER = [1, 0, 2];
  D.SLOT_POS = [];
  for (let k = 0; k < D.MAX_SLOTS; k++) {
    const col = COL_ORDER[k % 10];
    const row = ROW_ORDER[(k + Math.floor(k / 10)) % 3];
    const jitter = Math.sin(k * 12.9898) * 0.012;
    D.SLOT_POS.push({ u: (col + 0.25 + (row % 2) * 0.5) / 10 + jitter, v: row / 2 });
  }
  D.DRAW_ORDER = D.SLOT_POS.map((p, i) => i).sort((a, b) => D.SLOT_POS[a].v - D.SLOT_POS[b].v);
})(typeof window !== 'undefined' ? window : globalThis);
