// 숫자·시간 표기
(function (G) {
  'use strict';
  const MG = G.MG = G.MG || {};
  const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid'];

  MG.fmt = function (n) {
    if (n === Infinity) return '∞';
    if (!isFinite(n)) return '?';
    if (n < 0) return '-' + MG.fmt(-n);
    if (n < 1000) {
      if (n < 10 && n % 1 !== 0) return (Math.floor(n * 10) / 10).toFixed(1);
      return String(Math.floor(n));
    }
    const e = Math.floor(Math.log10(n) / 3);
    if (e < UNITS.length) {
      const v = n / Math.pow(1000, e);
      const s = v < 10 ? (Math.floor(v * 100) / 100).toFixed(2)
        : v < 100 ? (Math.floor(v * 10) / 10).toFixed(1)
        : String(Math.floor(v));
      return s + UNITS[e];
    }
    return n.toExponential(2).replace('e+', 'e');
  };

  MG.fmtMult = function (v) {
    if (v < 100) return (Math.round(v * 100) / 100).toString();
    return MG.fmt(v);
  };

  MG.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return h + '시간 ' + m + '분';
    if (m > 0) return m + '분 ' + s + '초';
    return s + '초';
  };
})(typeof window !== 'undefined' ? window : globalThis);
