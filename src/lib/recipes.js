import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, deleteDoc, updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase.js';
import { resizeImage } from './image.js';

const recipesCol = (uid) => collection(db, 'users', uid, 'recipes');

export function newRecipeId(uid) {
  return doc(recipesCol(uid)).id;
}

// 全レシピをリアルタイム購読（iPhoneで保存→Macに即反映）
export function useRecipes(uid) {
  const [state, setState] = useState({ recipes: [], loading: true, error: null });
  useEffect(() => {
    if (!uid) return undefined;
    const q = query(recipesCol(uid), orderBy('updatedAt', 'desc'));
    return onSnapshot(
      q,
      { includeMetadataChanges: false },
      (snap) => setState({
        recipes: snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })),
        loading: false,
        error: null
      }),
      (error) => setState((s) => ({ ...s, loading: false, error }))
    );
  }, [uid]);
  return state;
}

export function emptyRecipe() {
  return {
    title: '',
    description: '',
    servings: 2,
    totalMinutes: null,
    ingredients: [],
    steps: [],
    tags: [],
    notes: '',
    sourceUrl: '',
    imageUrl: '',
    photoPath: '',
    favorite: false
  };
}

export async function saveRecipe(uid, id, data, { isNew } = {}) {
  const payload = {
    title: data.title.trim(),
    description: data.description?.trim() || '',
    servings: Number(data.servings) > 0 ? Number(data.servings) : 2,
    totalMinutes: Number(data.totalMinutes) > 0 ? Number(data.totalMinutes) : null,
    ingredients: data.ingredients || [],
    steps: data.steps || [],
    tags: data.tags || [],
    notes: data.notes?.trim() || '',
    sourceUrl: data.sourceUrl?.trim() || '',
    imageUrl: data.imageUrl || '',
    photoPath: data.photoPath || '',
    favorite: !!data.favorite,
    updatedAt: serverTimestamp()
  };
  if (isNew) payload.createdAt = serverTimestamp();
  // オフライン中でも待たずに戻れるよう、書き込み完了は待たない（同期は自動）
  const p = setDoc(doc(recipesCol(uid), id), payload, { merge: true });
  if (navigator.onLine) await p;
}

export async function toggleFavorite(uid, recipe) {
  await updateDoc(doc(recipesCol(uid), recipe.id), { favorite: !recipe.favorite });
}

export async function deleteRecipe(uid, recipe) {
  await deleteDoc(doc(recipesCol(uid), recipe.id));
  if (recipe.photoPath) await deleteObject(ref(storage, recipe.photoPath)).catch(() => {});
}

export async function uploadPhoto(uid, recipeId, file) {
  const blob = await resizeImage(file, 1600, 0.85);
  const path = `users/${uid}/recipes/${recipeId}-${Date.now()}.jpg`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' });
  return { photoPath: path, imageUrl: await getDownloadURL(r) };
}

export async function removePhoto(path) {
  if (path) await deleteObject(ref(storage, path)).catch(() => {});
}

export async function importFromUrl(url) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '取り込みに失敗しました');
  return data;
}
