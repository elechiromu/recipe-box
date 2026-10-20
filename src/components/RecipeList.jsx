import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { IconPlus, IconSearch, IconStar, IconClock, IconPot } from './Icons.jsx';

const FILTER_KEY = 'recipe-box:filter';

function loadFilter() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY)) || {}; } catch { return {}; }
}

export default function RecipeList({ recipes, loading }) {
  const saved = loadFilter();
  const [q, setQ] = useState(saved.q || '');
  const [tag, setTag] = useState(saved.tag || '');
  const [favOnly, setFavOnly] = useState(!!saved.favOnly);

  // 詳細から戻ったとき検索条件を保つ
  const remember = (next) => {
    try { sessionStorage.setItem(FILTER_KEY, JSON.stringify({ q, tag, favOnly, ...next })); } catch { /* noop */ }
  };

  const tags = useMemo(() => {
    const count = new Map();
    recipes.forEach((r) => (r.tags || []).forEach((t) => count.set(t, (count.get(t) || 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [recipes]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return recipes.filter((r) => {
      if (favOnly && !r.favorite) return false;
      if (tag && !(r.tags || []).includes(tag)) return false;
      if (!words.length) return true;
      // タイトル・タグ・材料名で検索（「豚肉 玉ねぎ」で冷蔵庫の中身から探せる）
      const hay = [r.title, ...(r.tags || []), ...(r.ingredients || []).map((i) => i.name)].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [recipes, q, tag, favOnly]);

  return (
    <main className="page">
      <header className="list-head">
        <h1>レシピ</h1>
        <Link to="/new" className="btn primary icon-btn" aria-label="レシピを追加">
          <IconPlus /><span className="hide-sm">追加</span>
        </Link>
      </header>

      <div className="search">
        <IconSearch />
        <input
          type="search"
          placeholder="料理名・材料・タグで探す"
          value={q}
          onChange={(e) => { setQ(e.target.value); remember({ q: e.target.value }); }}
          enterKeyHint="search"
        />
      </div>

      <div className="chips" role="toolbar" aria-label="絞り込み">
        <button
          className={`chip ${favOnly ? 'on' : ''}`}
          onClick={() => { setFavOnly(!favOnly); remember({ favOnly: !favOnly }); }}
          aria-pressed={favOnly}
        >
          <IconStar filled={favOnly} width={15} height={15} /> お気に入り
        </button>
        {tags.map((t) => (
          <button
            key={t}
            className={`chip ${tag === t ? 'on' : ''}`}
            onClick={() => { const v = tag === t ? '' : t; setTag(v); remember({ tag: v }); }}
            aria-pressed={tag === t}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" />)}</div>
      ) : recipes.length === 0 ? (
        <div className="empty">
          <IconPot width={48} height={48} />
          <p>まだレシピがありません</p>
          <Link to="/new" className="btn primary">最初のレシピを追加</Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted center">条件に合うレシピがありません</p>
      ) : (
        <ul className="grid">
          {shown.map((r) => (
            <li key={r.id}>
              <Link to={`/r/${r.id}`} className="card">
                <div className="card-photo">
                  {r.imageUrl ? <img src={r.imageUrl} alt="" loading="lazy" /> : <IconPot width={36} height={36} />}
                  {r.favorite && <span className="fav-badge" aria-label="お気に入り"><IconStar filled width={14} height={14} /></span>}
                </div>
                <div className="card-body">
                  <h2>{r.title}</h2>
                  <p className="card-meta">
                    {r.totalMinutes ? <span><IconClock width={13} height={13} />{r.totalMinutes}分</span> : null}
                    {(r.tags || []).slice(0, 2).map((t) => <span key={t} className="tag">{t}</span>)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="list-foot">
        <span className="muted">{recipes.length}品</span>
        <button className="link-btn" onClick={() => signOut(auth)}>ログアウト</button>
      </footer>
    </main>
  );
}
