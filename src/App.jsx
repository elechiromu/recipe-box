import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';
import { useRecipes } from './lib/recipes.js';
import Login from './components/Login.jsx';
import RecipeList from './components/RecipeList.jsx';
import RecipeDetail from './components/RecipeDetail.jsx';
import RecipeEditor from './components/RecipeEditor.jsx';
import CookMode from './components/CookMode.jsx';

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <div className="splash" aria-busy="true" />;
  if (!user) return <Login />;
  return <SignedIn uid={user.uid} />;
}

function SignedIn({ uid }) {
  const { recipes, loading, error } = useRecipes(uid);
  const props = { uid, recipes, loading };

  if (error) {
    return (
      <main className="page narrow">
        <p className="error">レシピを読み込めませんでした：{error.message}</p>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<RecipeList {...props} />} />
      <Route path="/new" element={<RecipeEditor {...props} />} />
      <Route path="/r/:id" element={<RecipeDetail {...props} />} />
      <Route path="/r/:id/edit" element={<RecipeEditor {...props} />} />
      <Route path="/r/:id/cook" element={<CookMode {...props} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
