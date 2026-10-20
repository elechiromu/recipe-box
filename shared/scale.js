// 分量文字列を人数に合わせて換算する。
// 例: scaleAmount('大さじ1と1/2', 2) → '大さじ3'
//     scaleAmount('200g', 1.5)       → '300g'
//     scaleAmount('少々', 2)          → '少々'

const UNICODE_FRACTIONS = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅕': '1/5', '⅛': '1/8'
};

export function normalizeAmount(str) {
  if (!str) return '';
  let s = String(str)
    // 全角英数・記号を半角に
    .replace(/[０-９Ａ-Ｚａ-ｚ．／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[〜～]/g, '~')
    .replace(/　/g, ' ');
  // 「1½」→「1と1/2」、「½」→「1/2」
  s = s.replace(/(\d)\s*([½⅓⅔¼¾⅕⅛])/g, (_, d, f) => `${d}と${UNICODE_FRACTIONS[f]}`);
  s = s.replace(/[½⅓⅔¼¾⅕⅛]/g, (f) => UNICODE_FRACTIONS[f]);
  return s;
}

// 数値の並び（帯分数・分数・小数・整数）
const NUMBER_RE = /(\d+(?:\.\d+)?)\s*と\s*(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:\.\d+)?)/g;

const SPOON_RE = /(大さじ|小さじ|カップ|大匙|小匙|tbsp|tsp|cup)/i;
const METRIC_AFTER_RE = /^\s*(g|kg|ml|mL|cc|l|L|グラム|ミリ)/;

function parseMatch(m) {
  if (m[1] !== undefined) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  if (m[4] !== undefined) return Number(m[4]) / Number(m[5]);
  return Number(m[6]);
}

// 0.5 → '1/2'、1.5 → '1と1/2' のように料理らしい表記へ
function toKitchenFraction(value, denominators) {
  let best = { whole: Math.round(value), num: 0, den: 1, err: Math.abs(value - Math.round(value)) };
  for (const den of denominators) {
    const total = Math.round(value * den);
    const err = Math.abs(value - total / den);
    if (err < best.err - 1e-9) {
      best = { whole: Math.floor(total / den), num: total % den, den, err };
    }
  }
  const { whole, num, den } = best;
  if (num === 0) return String(whole === 0 && value > 0 ? formatDecimal(value) : whole);
  const g = gcd(num, den);
  const frac = `${num / g}/${den / g}`;
  return whole > 0 ? `${whole}と${frac}` : frac;
}

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

function formatDecimal(v) {
  if (v >= 100) return String(Math.round(v / 5) * 5);
  if (v >= 10) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

export function formatQuantity(value, context = 'count') {
  if (!isFinite(value) || value <= 0) return '0';
  if (context === 'metric') return formatDecimal(value);
  if (context === 'spoon') return toKitchenFraction(value, [2, 3, 4]);
  // 個数系（個・本・枚・片など）は 1/2・1/4 程度まで
  return value >= 10 ? String(Math.round(value)) : toKitchenFraction(value, [2, 3, 4]);
}

export function scaleAmount(amount, factor) {
  const s = normalizeAmount(amount);
  if (!s || factor === 1) return s;
  return s.replace(NUMBER_RE, (...args) => {
    const match = args.slice(0, 7);
    const offset = args[7];
    const before = s.slice(0, offset);
    const after = s.slice(offset + match[0].length);
    // 「18cm」「200℃」など分量でない数値は変えない
    if (/^\s*(cm|mm|℃|度|分|秒|時間|号|W)/.test(after)) return match[0];
    const value = parseMatch(match) * factor;
    let context = 'count';
    if (METRIC_AFTER_RE.test(after)) context = 'metric';
    else if (SPOON_RE.test(before.slice(-6))) context = 'spoon';
    return formatQuantity(value, context);
  });
}

// レシピの「何人分」表記から数値を取り出す。「2〜3人分」は小さい方。
export function parseServings(value) {
  if (typeof value === 'number' && value > 0) return value;
  const list = Array.isArray(value) ? value : [value];
  for (const v of list) {
    const m = normalizeAmount(v).match(/(\d+(?:\.\d+)?)/);
    if (m && Number(m[1]) > 0) return Number(m[1]);
  }
  return null;
}
