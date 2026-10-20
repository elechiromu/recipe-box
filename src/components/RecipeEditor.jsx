import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { parseIngredientsText, ingredientsToText, parseStepsText } from '../../shared/ingredients.js';
import { emptyRecipe, importFromUrl, newRecipeId, removePhoto, saveRecipe, uploadPhoto } from '../lib/recipes.js';
import { IconBack, IconCamera, IconClose, IconLink } from './Icons.jsx';

function toForm(r) {
  return {
    title: r.title || '',
    description: r.description || '',
    servings: r.servings || 2,
    totalMinutes: r.totalMinutes || '',
    ingredientsText: ingredientsToText(r.ingredients),
    stepsText: (r.steps || []).join('\n'),
    tagsText: (r.tags || []).join('、'),
    notes: r.notes || '',
    sourceUrl: r.sourceUrl || '',
    imageUrl: r.imageUrl || '',
    photoPath: r.photoPath || '',
    favorite: !!r.favorite
  };
}

export default function RecipeEditor({ uid, recipes, loading }) {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const isNew = !paramId;
  const [id] = useState(() => paramId || newRecipeId(uid));
  const existing = recipes.find((r) => r.id === paramId);

  const [form, setForm] = useState(() => toForm(existing || emptyRecipe()));
  const [loaded, setLoaded] = useState(isNew || !!existing);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  // 直リンクで編集画面を開いたとき、読み込み完了後にフォームへ反映
  useEffect(() => {
    if (!loaded && existing) { setForm(toForm(existing)); setLoaded(true); }
  }, [existing, loaded]);

  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview('');
    setForm((f) => ({ ...f, imageUrl: '' }));
    if (fileRef.current) fileRef.current.value = '';
  }

  function applyImport(r) {
    setForm((f) => ({
      ...f,
      title: r.title || f.title,
      description: r.description || f.description,
      servings: r.servings || f.servings,
      totalMinutes: r.totalMinutes || f.totalMinutes,
      ingredientsText: r.ingredients?.length ? ingredientsToText(r.ingredients) : f.ingredientsText,
      stepsText: r.steps?.length ? r.steps.join('\n') : f.stepsText,
      tagsText: r.tags?.length ? r.tags.join('、') : f.tagsText,
      sourceUrl: r.sourceUrl || f.sourceUrl,
      imageUrl: photoFile ? f.imageUrl : r.imageUrl || f.imageUrl
    }));
  }

  async function onSave(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('料理名を入力してください'); return; }
    setSaving(true);
    setError('');
    try {
      let { imageUrl, photoPath } = form;
      const oldPath = existing?.photoPath;
      if (photoFile) {
        ({ imageUrl, photoPath } = await uploadPhoto(uid, id, photoFile));
      } else if (!imageUrl) {
        photoPath = '';
      } else if (imageUrl !== existing?.imageUrl) {
        photoPath = ''; // 取り込んだ外部画像
      }
      await saveRecipe(uid, id, {
        ...form,
        imageUrl,
        photoPath,
        ingredients: parseIngredientsText(form.ingredientsText),
        steps: parseStepsText(form.stepsText),
        tags: [...new Set(form.tagsText.split(/[,、，\s]+/).map((t) => t.trim()).filter(Boolean))]
      }, { isNew });
      if (oldPath && oldPath !== photoPath) removePhoto(oldPath);
      navigate(`/r/${id}`, { replace: true });
    } catch (err) {
      setError(`保存できませんでした：${err.message}`);
      setSaving(false);
    }
  }

  if (!isNew && !existing) {
    return (
      <main className="page narrow">
        <Link to="/" className="back"><IconBack />レシピ一覧</Link>
        <p className="muted">{loading ? '読み込み中…' : 'レシピが見つかりません'}</p>
      </main>
    );
  }

  const shownPhoto = photoPreview || form.imageUrl;

  return (
    <main className="page narrow editor">
      <nav className="detail-nav">
        <button className="back link-btn" onClick={() => navigate(-1)}><IconBack />キャンセル</button>
        <h1 className="nav-title">{isNew ? '新しいレシピ' : 'レシピを編集'}</h1>
        <span />
      </nav>

      {isNew && <ImportPanel onImported={applyImport} />}

      <form onSubmit={onSave} className="form">
        <div className="photo-field">
          {shownPhoto ? (
            <div className="photo-preview">
              <img src={shownPhoto} alt="" />
              <button type="button" className="photo-remove" onClick={clearPhoto} aria-label="写真を外す"><IconClose width={18} height={18} /></button>
            </div>
          ) : null}
          <label className="btn ghost">
            <IconCamera width={18} height={18} />
            {shownPhoto ? '写真を変更' : '写真を追加'}
            <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} hidden />
          </label>
        </div>

        <label>料理名<input value={form.title} onChange={set('title')} placeholder="例：豚の生姜焼き" required /></label>
        <label>ひとこと<textarea rows={2} value={form.description} onChange={set('description')} placeholder="味の特徴やコツなど" /></label>

        <div className="row">
          <label>何人分<input type="number" inputMode="numeric" min="1" max="20" value={form.servings} onChange={set('servings')} /></label>
          <label>調理時間（分）<input type="number" inputMode="numeric" min="0" value={form.totalMinutes} onChange={set('totalMinutes')} placeholder="30" /></label>
        </div>

        <label>
          材料
          <span className="field-hint">1行に「材料名 分量」。見出しは「■たれ」のように■から</span>
          <textarea rows={8} value={form.ingredientsText} onChange={set('ingredientsText')} placeholder={'豚ロース薄切り 200g\n玉ねぎ 1/2個\n■たれ\n醤油 大さじ2\nみりん 大さじ2\nすりおろし生姜 小さじ1'} />
        </label>

        <label>
          作り方
          <span className="field-hint">1行に1つの手順。「10分」などと書くと調理モードでタイマーになります</span>
          <textarea rows={8} value={form.stepsText} onChange={set('stepsText')} placeholder={'玉ねぎを薄切りにする。\nたれの材料を混ぜておく。\nフライパンで豚肉を中火で2分焼く。'} />
        </label>

        <label>タグ<input value={form.tagsText} onChange={set('tagsText')} placeholder="和食、肉、お弁当（読点区切り）" /></label>
        <label>メモ<textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="次は砂糖を少し控える、など" /></label>
        <label>元のレシピURL<input type="url" inputMode="url" value={form.sourceUrl} onChange={set('sourceUrl')} placeholder="https://" /></label>

        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn primary block" disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </form>
    </main>
  );
}

function ImportPanel({ onImported }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function run(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const { found, recipe } = await importFromUrl(url.trim());
      onImported(recipe);
      setMsg(found
        ? { ok: true, text: `材料${recipe.ingredients.length}件・手順${recipe.steps.length}件を読み込みました。確認して保存してください。` }
        : { ok: false, text: 'このページはレシピ情報が読み取れなかったので、タイトルと画像だけ入れました。' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="import-panel" onSubmit={run}>
      <p className="import-title"><IconLink width={16} height={16} />Webのレシピから取り込む</p>
      <div className="import-row">
        <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="レシピページのURL" />
        <button className="btn" disabled={busy || !url.trim()}>{busy ? '読込中…' : '取り込む'}</button>
      </div>
      {msg && <p className={msg.ok ? 'success' : 'warn'}>{msg.text}</p>}
    </form>
  );
}
