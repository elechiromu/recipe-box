import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { findTimers } from '../../shared/ingredients.js';
import { addLog, todayKey } from '../lib/logs.js';
import { IngredientList } from './RecipeDetail.jsx';
import { IconClose, IconList, IconTimer } from './Icons.jsx';

// 画面を消さない（iOS 16.4以降のSafari / Mac Safari・Chromeで有効）
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let cancelled = false;
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen');
          if (cancelled) lock.release();
        }
      } catch { /* 省電力モードなどで拒否される場合がある */ }
    };
    request();
    const onVis = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}

// タイマー終了音。最初のタップで AudioContext を作っておくとiPhoneでも鳴る
function useChime() {
  const ctxRef = useRef(null);
  const unlock = useCallback(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctxRef.current) ctxRef.current = new AC();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
  }, []);
  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
    navigator.vibrate?.([300, 150, 300]);
  }, []);
  return { unlock, play };
}

function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export default function CookMode({ uid, recipes, loading, logs = [] }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const recipe = recipes.find((r) => r.id === id);

  const steps = useMemo(() => {
    let section = '';
    const out = [];
    (recipe?.steps || []).forEach((s) => {
      if (/^【.+】$/.test(s)) section = s.slice(1, -1);
      else out.push({ text: s, section });
    });
    return out;
  }, [recipe]);

  const [index, setIndex] = useState(0);
  const [showIng, setShowIng] = useState(false);
  const [timers, setTimers] = useState([]); // { id, label, endsAt, done }
  const [now, setNow] = useState(Date.now());
  const { unlock, play } = useChime();
  useWakeLock();

  const go = useCallback((d) => setIndex((i) => Math.min(Math.max(0, i + d), steps.length - 1)), [steps.length]);

  // キーボード（Mac）：← → / スペース
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'Escape') navigate(`/r/${id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, id, navigate]);

  // 横スワイプ（iPhone）
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    touch.current = null;
  };

  // タイマーの刻み。終了時刻で計算するので、画面を閉じても時間はずれない
  useEffect(() => {
    if (!timers.some((t) => !t.done)) return undefined;
    const iv = setInterval(() => {
      const n = Date.now();
      setNow(n);
      const due = timers.filter((t) => !t.done && t.endsAt <= n).map((t) => t.id);
      if (due.length) {
        play();
        setTimers((ts) => ts.map((t) => (due.includes(t.id) ? { ...t, done: true } : t)));
      }
    }, 250);
    return () => clearInterval(iv);
  }, [timers, play]);

  function startTimer(label, seconds) {
    unlock();
    setNow(Date.now());
    setTimers((ts) => [...ts, { id: Date.now() + Math.random(), label: `手順${index + 1}・${label}`, endsAt: Date.now() + seconds * 1000, done: false }]);
  }

  if (!recipe) {
    return <main className="page narrow"><p className="muted">{loading ? '読み込み中…' : 'レシピが見つかりません'}</p></main>;
  }

  const servings = Number(params.get('servings')) || recipe.servings || 2;
  const factor = servings / (recipe.servings || 2);
  const step = steps[index];
  const stepTimers = step ? findTimers(step.text) : [];
  const isLast = index === steps.length - 1;

  return (
    <div className="cook" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="cook-top">
        <Link to={`/r/${id}`} className="icon-only" aria-label="調理モードを終了"><IconClose /></Link>
        <div className="cook-title">
          <span>{recipe.title}</span>
          <small>{servings}人分</small>
        </div>
        <button className={`icon-only ${showIng ? 'on' : ''}`} onClick={() => setShowIng(!showIng)} aria-pressed={showIng} aria-label="材料を表示">
          <IconList />
        </button>
      </header>

      <div className="cook-progress" aria-hidden="true">
        <div style={{ width: `${((index + 1) / Math.max(1, steps.length)) * 100}%` }} />
      </div>

      {timers.length > 0 && (
        <div className="timer-bar">
          {timers.map((t) => (
            <div key={t.id} className={`timer ${t.done ? 'ringing' : ''}`}>
              <IconTimer width={16} height={16} />
              <span className="timer-label">{t.label}</span>
              <strong>{t.done ? '終了！' : fmt((t.endsAt - now) / 1000)}</strong>
              <button onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))} aria-label={t.done ? '閉じる' : 'タイマーを止める'}>
                <IconClose width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <main className="cook-body">
        {showIng ? (
          <div className="cook-ingredients">
            <h2>材料（{servings}人分）</h2>
            <IngredientList ingredients={recipe.ingredients || []} factor={factor} checkable />
          </div>
        ) : step ? (
          <article className="cook-step" key={index}>
            <p className="cook-count">
              {step.section && <span className="cook-section">{step.section}</span>}
              手順 {index + 1} / {steps.length}
            </p>
            <p className="cook-text">{step.text}</p>
            {stepTimers.length > 0 && (
              <div className="timer-chips">
                {stepTimers.map((t, i) => (
                  <button key={i} className="btn ghost" onClick={() => startTimer(t.label, t.seconds)}>
                    <IconTimer width={18} height={18} />{t.label}のタイマー
                  </button>
                ))}
              </div>
            )}
          </article>
        ) : (
          <p className="muted">手順が登録されていません</p>
        )}
      </main>

      <footer className="cook-nav">
        <button className="btn" onClick={() => go(-1)} disabled={index === 0}>前へ</button>
        {isLast ? (
          <button
            className="btn primary"
            onClick={async () => {
              // 今日まだ記録していなければカレンダーに記録
              if (!logs.some((l) => l.recipeId === id && l.date === todayKey())) await addLog(uid, recipe).catch(() => {});
              navigate(`/r/${id}`);
            }}
          >
            完成！カレンダーに記録
          </button>
        ) : (
          <button className="btn primary" onClick={() => go(1)}>次へ</button>
        )}
      </footer>
    </div>
  );
}
