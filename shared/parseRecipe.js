// レシピサイトのHTMLから schema.org/Recipe（JSON-LD）を読み取る。
// クックパッド・クラシル・DELISH KITCHEN・各メーカーのレシピページなど、
// 多くのサイトが検索エンジン向けにこの形式でレシピを埋め込んでいる。
import { splitIngredientLine, cleanStep } from './ingredients.js';
import { parseServings } from './scale.js';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function clean(s) {
  return decodeEntities(String(s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t　]+/g, ' ')
    .trim();
}

function isRecipe(node) {
  const t = node?.['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
}

function findRecipeNode(data) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) {
    for (const d of data) { const r = findRecipeNode(d); if (r) return r; }
    return null;
  }
  if (isRecipe(data)) return data;
  if (data['@graph']) return findRecipeNode(data['@graph']);
  if (data.mainEntity) return findRecipeNode(data.mainEntity);
  return null;
}

function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim().replace(/^<!--|-->$/g, '');
    try {
      out.push(JSON.parse(raw));
    } catch {
      // 制御文字が混ざって壊れていることがあるので掃除して再挑戦
      try { out.push(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' '))); } catch { /* skip */ }
    }
  }
  return out;
}

function pickImage(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) {
    for (const i of img) { const u = pickImage(i); if (u) return u; }
    return '';
  }
  return img.url || img.contentUrl || '';
}

function flattenInstructions(ins) {
  if (!ins) return [];
  if (typeof ins === 'string') {
    return clean(ins).split(/\n+/).map(cleanStep).filter(Boolean);
  }
  if (Array.isArray(ins)) return ins.flatMap(flattenInstructions);
  if (ins['@type'] === 'HowToSection' || ins.itemListElement) {
    const head = ins.name ? [`【${clean(ins.name)}】`] : [];
    return [...head, ...flattenInstructions(ins.itemListElement)];
  }
  const text = ins.text || ins.name || ins.description;
  return text ? flattenInstructions(String(text)) : [];
}

// ISO 8601 の期間（PT1H30M）を分に
export function isoDurationToMinutes(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const min = (Number(m[1] || 0) * 24 + Number(m[2] || 0)) * 60 + Number(m[3] || 0) + Math.round(Number(m[4] || 0) / 60);
  return min > 0 ? min : null;
}

function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re);
  return m ? decodeEntities(m[1] ?? m[2]) : '';
}

function absolutize(url, base) {
  if (!url) return '';
  try { return new URL(url, base).href; } catch { return ''; }
}

export function parseRecipeHtml(html, pageUrl) {
  const node = extractJsonLd(html).map(findRecipeNode).find(Boolean);

  if (!node) {
    // レシピ情報が埋め込まれていないページ：タイトルと画像だけ拾う
    const title = metaContent(html, 'og:title') || clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    return {
      found: false,
      recipe: {
        title: title.slice(0, 200),
        description: metaContent(html, 'og:description').slice(0, 1000),
        imageUrl: absolutize(metaContent(html, 'og:image'), pageUrl),
        servings: 2,
        ingredients: [],
        steps: [],
        totalMinutes: null,
        tags: [],
        sourceUrl: pageUrl
      }
    };
  }

  const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : node.ingredients || [])
    .map((s) => splitIngredientLine(clean(s)))
    .filter(Boolean);

  const keywords = typeof node.keywords === 'string' ? node.keywords.split(/[,、]/) : node.keywords || [];
  const category = [].concat(node.recipeCategory || []);
  const tags = [...new Set([...category, ...keywords].map((t) => clean(t)).filter((t) => t && t.length <= 20))].slice(0, 6);

  return {
    found: true,
    recipe: {
      title: clean(node.name).slice(0, 200),
      description: clean(node.description).slice(0, 1000),
      imageUrl: absolutize(pickImage(node.image), pageUrl),
      servings: parseServings(node.recipeYield) || 2,
      ingredients,
      steps: flattenInstructions(node.recipeInstructions),
      totalMinutes: isoDurationToMinutes(node.totalTime) ||
        ((isoDurationToMinutes(node.prepTime) || 0) + (isoDurationToMinutes(node.cookTime) || 0)) || null,
      tags,
      sourceUrl: pageUrl
    }
  };
}
