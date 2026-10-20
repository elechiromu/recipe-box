// Vercel サーバーレス関数：レシピページのURLを受け取り、材料・手順を返す。
// ブラウザから直接よそのサイトを読むとCORSで止まるため、ここで代わりに取得する。
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { parseRecipeHtml } from '../shared/parseRecipe.js';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

async function verifyUser(req) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!projectId || !token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId
    });
    return payload.sub || null;
  } catch {
    return null;
  }
}

// 社内ネットワークやクラウドのメタデータへのアクセスを防ぐ
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

async function assertPublicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('URLの形式が正しくありません'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('http/https のURLだけ取り込めます');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('このURLは取り込めません');
  const addrs = await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error('サイトが見つかりませんでした');
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error('このURLは取り込めません');
  return url;
}

async function fetchPage(rawUrl) {
  let url = await assertPublicUrl(rawUrl);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.8'
      }
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location'), url).href);
      continue;
    }
    if (!res.ok) throw new Error(`ページを開けませんでした（${res.status}）`);

    // 大きすぎるページは途中で打ち切る
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    const type = res.headers.get('content-type') || '';
    const charset = (type.match(/charset=([\w-]+)/i) || buf.toString('latin1', 0, 4096).match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
    let html;
    try { html = new TextDecoder(charset || 'utf-8').decode(buf); } catch { html = new TextDecoder('utf-8').decode(buf); }
    return { html, finalUrl: url.href };
  }
  throw new Error('リダイレクトが多すぎます');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'ログインが必要です' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (!body.url || typeof body.url !== 'string') return res.status(400).json({ error: 'URLを入力してください' });

  try {
    const { html, finalUrl } = await fetchPage(body.url.trim());
    const result = parseRecipeHtml(html, finalUrl);
    return res.status(200).json(result);
  } catch (e) {
    const msg = e?.name === 'TimeoutError' ? 'サイトの応答がありませんでした' : e?.message || '取り込みに失敗しました';
    return res.status(422).json({ error: msg });
  }
}
