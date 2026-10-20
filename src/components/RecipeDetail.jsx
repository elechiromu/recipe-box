import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { scaleAmount } from '../../shared/scale.js';
import { deleteRecipe, toggleFavorite } from '../lib/recipes.js';
import { IconBack, IconClock, IconEdit, IconLink, IconPot, IconStar, IconTrash } from './Icons.jsx';

export function ServingsStepper({ value, onChange }) {
  return (
    <div className="stepper" role="group" aria-label="人数">
      <button onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="1人分減らす">−</button>
      <output aria-live="polite">{value}人分</output>
      <button onClick={() => onChange(Math.min(20, value + 1))} disabled={value >= 20} aria-label="1人分増やす">＋</button>
    </div>
  );
}

export function IngredientList({ ingredients, factor, checkable }) {
  const [checked, setChecked] = useState({});
  return (
    <ul className="ingredients">
      {ingredients.map((ing, i) =>
        ing.heading ? (
          <li key={i} className="ing-heading">{ing.name}</li>
        ) : (
          <li key={i} className={checked[i] ? 'done' : ''}>
            {checkable ? (
              <label>
                <input type="checkbox" checked={!!checked[i]} onChange={() => setChecked({ ...checked, [i]: !checked[i] })} />
                <span className="ing-name">{ing.name}</span>
              </label>
            ) : (
              <span className="ing-name">{ing.name}</span>
            )}
            <span className={`ing-amount ${factor !== 1 && ing.amount ? 'scaled' : ''}`}>{scaleAmount(ing.amount, factor)}</span>
          </li>
        )
      )}
    </ul>
  );
}

export default function RecipeDetail({ uid, recipes, loading }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const recipe = recipes.find((r) => r.id === id);
  const [servings, setServings] = useState(null);

  if (!recipe) {
    return (
      <main className="page narrow">
        <Link to="/" className="back"><IconBack />レシピ一覧</Link>
        <p className="muted">{loading ? '読み込み中…' : 'レシピが見つかりません'}</p>
      </main>
    );
  }

  const base = recipe.servings || 2;
  const current = servings ?? base;
  const factor = current / base;

  async function onDelete() {
    if (!confirm(`「${recipe.title}」を削除しますか？`)) return;
    navigate('/', { replace: true });
    await deleteRecipe(uid, recipe);
  }

  let stepNo = 0;

  return (
    <main className="page detail">
      <nav className="detail-nav">
        <Link to="/" className="back"><IconBack />レシピ一覧</Link>
        <div className="nav-actions">
          <button className="icon-only" onClick={() => toggleFavorite(uid, recipe)} aria-pressed={!!recipe.favorite} aria-label="お気に入り">
            <IconStar filled={recipe.favorite} className={recipe.favorite ? 'star-on' : ''} />
          </button>
          <Link to={`/r/${id}/edit`} className="icon-only" aria-label="編集"><IconEdit /></Link>
          <button className="icon-only danger" onClick={onDelete} aria-label="削除"><IconTrash /></button>
        </div>
      </nav>

      <div className="detail-layout">
        <div className="detail-hero">
          {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" /> : <div className="hero-placeholder"><IconPot width={56} height={56} /></div>}
        </div>

        <div className="detail-main">
          <h1 className="recipe-title">{recipe.title}</h1>
          {recipe.description && <p className="lead">{recipe.description}</p>}
          <p className="meta-row">
            {recipe.totalMinutes ? <span><IconClock width={16} height={16} />{recipe.totalMinutes}分</span> : null}
            {(recipe.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
          </p>

          {recipe.steps?.length > 0 && (
            <Link to={`/r/${id}/cook?servings=${current}`} className="btn primary block cook-btn">調理モードで作る</Link>
          )}

          <section>
            <div className="section-head">
              <h2>材料</h2>
              <ServingsStepper value={current} onChange={setServings} />
            </div>
            {recipe.ingredients?.length ? (
              <IngredientList ingredients={recipe.ingredients} factor={factor} checkable />
            ) : <p className="muted">材料が登録されていません</p>}
            {factor !== 1 && <p className="hint">元のレシピは{base}人分。色つきの分量は換算後の目安です。</p>}
          </section>

          <section>
            <h2>作り方</h2>
            <ol className="steps">
              {(recipe.steps || []).map((s, i) =>
                /^【.+】$/.test(s) ? (
                  <li key={i} className="step-heading">{s.slice(1, -1)}</li>
                ) : (
                  <li key={i}><span className="step-no">{++stepNo}</span><p>{s}</p></li>
                )
              )}
            </ol>
          </section>

          {recipe.notes && (
            <section>
              <h2>メモ</h2>
              <p className="notes">{recipe.notes}</p>
            </section>
          )}

          {recipe.sourceUrl && (
            <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="source-link">
              <IconLink width={16} height={16} />元のレシピを見る（{safeHost(recipe.sourceUrl)}）
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

function safeHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'リンク'; }
}
