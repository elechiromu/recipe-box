// 「玉ねぎ　1/2個」のような1行を { name, amount } に分ける。
// 「■A」「【たれ】」のような行は見出し（heading: true）として扱う。

const HEADING_RE = /^\s*(?:[■□●○◆◇★☆▼▽]\s*\S|【[^】]+】\s*$|\[[^\]]+\]\s*$|\(?[A-ZＡ-Ｚ][)）]?\s*$)/;

// 分量として扱う書き方
const NUM = String.raw`(?:\d+(?:\.\d+)?(?:\s*と\s*\d+\/\d+)?|\d+\/\d+|[½⅓⅔¼¾])(?:\s*[~〜～\-]\s*\d+(?:\.\d+)?)?`;
const UNIT = String.raw`(?:kg|mg|g|ml|mL|cc|L|l|グラム|キロ|リットル|ミリリットル|cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|lb|cloves?|pieces?|個|本|枚|片|つ|かけ|缶|袋|パック|束|株|房|玉|尾|切れ|合|杯|カップ|丁|粒|cm)`;
const WORDS = '少々|適量|適宜|お好みで|ひとつまみ|ひとかけ|少量|たっぷり';
const AMOUNT = String.raw`(?:(?:大さじ|小さじ|大匙|小匙|カップ)\s*${NUM}|${NUM}\s*${UNIT}?|${WORDS})`;

const AMOUNT_ONLY_RE = new RegExp(`^${AMOUNT}$`, 'i');
const AMOUNT_FIRST_RE = new RegExp(`^(${AMOUNT})\\s+(.+)$`, 'i');
const SPACE_AMOUNT_RE = new RegExp(`^(.+?)\\s+(${AMOUNT})$`, 'i');
const GLUED_AMOUNT_RE = new RegExp(`^(.*?[^\\d\\s./~〜～\\-])(${AMOUNT})$`, 'i');
const HAS_AMOUNT_RE = new RegExp(AMOUNT, 'i');

function normalizeLine(raw) {
  return String(raw ?? '')
    .replace(/[０-９Ａ-Ｚａ-ｚ．／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// メモ部分（末尾の（　））を外して分ける
function splitCore(core) {
  // 「醤油…大さじ1」「醤油：大さじ1」
  const sep = core.match(/^(.+?)\s*(?:…+|‥+|:|：|\.{3,})\s*(.+)$/);
  if (sep && HAS_AMOUNT_RE.test(sep[2])) return { name: sep[1].trim(), amount: sep[2].trim() };

  // 「2L 茹で用の水」「大さじ1 サラダ油」「2 cups flour」：分量が先
  const first = core.match(AMOUNT_FIRST_RE);
  if (first) return { name: first[2].trim(), amount: first[1].trim() };

  // 「玉ねぎ 1/2個」：名前 分量
  const spaced = core.match(SPACE_AMOUNT_RE);
  if (spaced) return { name: spaced[1].trim(), amount: spaced[2].trim() };

  // 「ウインナー4本」「塩少々」：空白なし
  const glued = core.match(GLUED_AMOUNT_RE);
  if (glued) return { name: glued[1].trim(), amount: glued[2].trim() };

  return { name: core, amount: '' };
}

export function splitIngredientLine(raw) {
  const line = normalizeLine(raw);
  if (!line) return null;

  if (HEADING_RE.test(line)) {
    return { name: line.replace(/^[■□●○◆◇★☆▼▽]\s*/, ''), amount: '', heading: true };
  }

  // 末尾の（斜め切り）（炒め用）などのメモは名前の後ろに付け直す
  let core = line;
  let note = '';
  const m = line.match(/^(.*?\S)\s*([（(][^（）()]*[)）])$/);
  if (m) { core = m[1]; note = m[2]; }

  // 分量だけの行（例:「200g（約2人分）」）はそのまま
  if (AMOUNT_ONLY_RE.test(core)) return { name: line, amount: '' };

  const { name, amount } = splitCore(core);
  if (!amount && note && HAS_AMOUNT_RE.test(note)) {
    // 「豚肉（約200g）」のようにメモの中にしか分量がない場合
    return { name, amount: note.slice(1, -1).trim() };
  }
  return { name: name + note, amount };
}

export function parseIngredientsText(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(splitIngredientLine)
    .filter(Boolean);
}

export function ingredientsToText(list = []) {
  return list
    .map((i) => (i.heading ? `■${i.name}` : [i.name, i.amount].filter(Boolean).join(' ')))
    .join('\n');
}

// 手順のテキストを配列に。先頭の「1.」「①」「(1)」などは取り除く。
export function cleanStep(s) {
  return String(s ?? '')
    .replace(/^\s*(?:\(?\d+[.)）．、]|[①-⑳]|STEP\s*\d+[:：]?|手順\s*\d+[:：]?)\s*/i, '')
    .trim();
}

export function parseStepsText(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(cleanStep)
    .filter(Boolean);
}

// 手順の文章から「10分」「30秒」「1時間」を見つけてタイマー候補にする
export function findTimers(text) {
  const found = [];
  const s = String(text ?? '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const re = /(?:(\d+(?:\.\d+)?)\s*時間\s*)?(?:(\d+)\s*[~〜～\-]\s*)?(\d+)\s*(分|秒)|(\d+(?:\.\d+)?)\s*時間/g;
  let m;
  while ((m = re.exec(s))) {
    let seconds;
    let label = m[0].trim();
    if (m[5]) {
      seconds = Number(m[5]) * 3600;
    } else {
      // 「5〜6分」は長い方を採用（焦げより生焼けを防ぐ）
      const n = Number(m[3]);
      seconds = (m[1] ? Number(m[1]) * 3600 : 0) + (m[4] === '分' ? n * 60 : n);
    }
    if (seconds > 0 && seconds <= 24 * 3600) found.push({ label, seconds });
  }
  return found;
}
