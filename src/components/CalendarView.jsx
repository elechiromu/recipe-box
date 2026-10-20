import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addLog, dateKey, deleteLog, resolveLog, todayKey } from '../lib/logs.js';
import { IconBack, IconClose, IconPlus, IconPot, IconSearch, IconTrash } from './Icons.jsx';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const MONTH_KEY = 'recipe-box:calendar-month';

function loadMonth() {
  try {
    const v = JSON.parse(sessionStorage.getItem(MONTH_KEY));
    if (v && Number.isInteger(v.y) && Number.isInteger(v.m)) return v;
  } catch { /* noop */ }
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}

function formatDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const w = WEEK[new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日（${w}）`;
}

export default function CalendarView({ uid, recipes, logs }) {
  const [{ y, m }, setMonth] = useState(loadMonth);
  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [picking, setPicking] = useState(false);

  const move = (delta) => {
    const d = new Date(y, m + delta, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() };
    setMonth(next);
    try { sessionStorage.setItem(MONTH_KEY, JSON.stringify(next)); } catch { /* noop */ }
  };
  const goToday = () => {
    const d = new Date();
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
    try { sessionStorage.removeItem(MONTH_KEY); } catch { /* noop */ }
  };

  const byDate = useMemo(() => {
    const map = new Map();
    // 同じ日の中は記録した順
    [...logs].reverse().forEach((l) => {
      const r = resolveLog(l, recipes);
      if (!map.has(l.date)) map.set(l.date, []);
      map.get(l.date).push(r);
    });
    return map;
  }, [logs, recipes]);

  const cells = useMemo(() => {
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(d);
    while (out.length % 7) out.push(null);
    return out;
  }, [y, m]);

  const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  const monthLogs = logs.filter((l) => l.date.startsWith(monthPrefix));
  const cookedDays = new Set(monthLogs.map((l) => l.date)).size;

  // 今月よく作った料理
  const top = useMemo(() => {
    const count = new Map();
    monthLogs.forEach((l) => count.set(l.recipeId, (count.get(l.recipeId) || 0) + 1));
    return [...count.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, n]) => ({ ...resolveLog(monthLogs.find((l) => l.recipeId === id), recipes), n }));
  }, [monthLogs, recipes]);

  const dayItems = byDate.get(selected) || [];

  return (
    <main className="page calendar-page">
      <nav className="detail-nav">
        <Link to="/" className="back"><IconBack />レシピ一覧</Link>
        <button className="link-btn today-btn" onClick={goToday}>今日</button>
      </nav>

      <div className="cal-layout">
        <section className="cal-main">
          <header className="cal-head">
            <button className="icon-only" onClick={() => move(-1)} aria-label="前の月">‹</button>
            <h1>{y}年{m + 1}月</h1>
            <button className="icon-only" onClick={() => move(1)} aria-label="次の月">›</button>
          </header>
          <p className="cal-summary">
            {cookedDays ? <>今月は<strong>{cookedDays}日</strong>・<strong>{monthLogs.length}品</strong>作りました</> : '今月はまだ記録がありません'}
          </p>

          <div className="cal-grid" role="grid">
            {WEEK.map((w, i) => (
              <div key={w} className={`cal-week ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`} role="columnheader">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="cal-cell empty" />;
              const key = dateKey(y, m, d);
              const items = byDate.get(key) || [];
              const main = items[0];
              const dow = i % 7;
              return (
                <button
                  key={i}
                  className={`cal-cell ${key === today ? 'today' : ''} ${key === selected ? 'selected' : ''} ${items.length ? 'has' : ''}`}
                  onClick={() => { setSelected(key); setPicking(false); }}
                  aria-label={`${m + 1}月${d}日 ${items.map((x) => x.title).join('、') || '記録なし'}`}
                >
                  <span className={`cal-day ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}`}>{d}</span>
                  {main && (
                    <span className="cal-thumb">
                      {main.imageUrl ? <img src={main.imageUrl} alt="" loading="lazy" /> : <span className="cal-initial">{main.title.slice(0, 1)}</span>}
                      {items.length > 1 && <span className="cal-more">+{items.length - 1}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {top.length > 0 && (
            <div className="cal-top">
              <h2>今月よく作った料理</h2>
              <ul>
                {top.map((t) => (
                  <li key={t.recipeId}>
                    <Link to={`/r/${t.recipeId}`}>{t.title}</Link><span>{t.n}回</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="cal-day-panel">
          <div className="section-head">
            <h2>{formatDay(selected)}</h2>
            {!picking && (
              <button className="btn ghost small" onClick={() => setPicking(true)}><IconPlus width={16} height={16} />記録する</button>
            )}
          </div>

          {picking ? (
            <RecipePicker
              recipes={recipes}
              onPick={async (r) => { setPicking(false); await addLog(uid, r, selected); }}
              onCancel={() => setPicking(false)}
            />
          ) : dayItems.length === 0 ? (
            <p className="muted">この日の記録はありません</p>
          ) : (
            <ul className="log-list">
              {dayItems.map((l) => (
                <li key={l.id}>
                  <Link to={l.exists ? `/r/${l.recipeId}` : '#'} className="log-item">
                    <span className="log-thumb">{l.imageUrl ? <img src={l.imageUrl} alt="" /> : <IconPot width={22} height={22} />}</span>
                    <span className="log-title">{l.title}{!l.exists && <small>（削除済みのレシピ）</small>}</span>
                  </Link>
                  <button
                    className="icon-only danger"
                    aria-label="記録を消す"
                    onClick={() => confirm(`${formatDay(selected)}の「${l.title}」の記録を消しますか？`) && deleteLog(uid, l.id)}
                  >
                    <IconTrash width={18} height={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function RecipePicker({ recipes, onPick, onCancel }) {
  const [q, setQ] = useState('');
  const shown = recipes.filter((r) => !q.trim() || r.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="picker">
      <div className="picker-head">
        <div className="search">
          <IconSearch />
          <input autoFocus type="search" placeholder="作った料理を選ぶ" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="icon-only" onClick={onCancel} aria-label="やめる"><IconClose /></button>
      </div>
      {shown.length === 0 ? (
        <p className="muted">{recipes.length ? '見つかりません' : 'まずレシピを登録してください'}</p>
      ) : (
        <ul className="log-list picker-list">
          {shown.map((r) => (
            <li key={r.id}>
              <button className="log-item" onClick={() => onPick(r)}>
                <span className="log-thumb">{r.imageUrl ? <img src={r.imageUrl} alt="" /> : <IconPot width={22} height={22} />}</span>
                <span className="log-title">{r.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
