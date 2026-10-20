import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

// 作った料理の記録：users/{uid}/logs/{logId}
// { date: 'YYYY-MM-DD', recipeId, title, imageUrl, createdAt }
const logsCol = (uid) => collection(db, 'users', uid, 'logs');

export function todayKey(d = new Date()) {
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dateKey(y, m, day) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function useLogs(uid) {
  const [state, setState] = useState({ logs: [], loading: true });
  useEffect(() => {
    if (!uid) return undefined;
    const q = query(logsCol(uid), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snap) => setState({ logs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      () => setState((s) => ({ ...s, loading: false }))
    );
  }, [uid]);
  return state;
}

export async function addLog(uid, recipe, date = todayKey()) {
  const p = addDoc(logsCol(uid), {
    date,
    recipeId: recipe.id,
    title: recipe.title,
    imageUrl: recipe.imageUrl || '',
    createdAt: serverTimestamp()
  });
  if (navigator.onLine) await p;
}

export async function deleteLog(uid, logId) {
  await deleteDoc(doc(logsCol(uid), logId));
}

// レシピ側の最新の写真・名前を優先して表示する
export function resolveLog(log, recipes) {
  const r = recipes.find((x) => x.id === log.recipeId);
  return { ...log, title: r?.title || log.title, imageUrl: r?.imageUrl || log.imageUrl, exists: !!r };
}
