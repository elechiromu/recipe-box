import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase.js';

// iPhoneのホーム画面アプリではGoogleのポップアップ認証が不安定なため、
// メール＋パスワード（iCloudキーチェーンで自動入力可）にしている
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'メールアドレスかパスワードが違います'
          : err.code === 'auth/network-request-failed'
            ? 'ネットにつながっていません'
            : 'ログインできませんでした'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <img src="/icons/icon-192.png" alt="" width="72" height="72" className="login-icon" />
        <h1>Recipe Box</h1>
        <form onSubmit={submit}>
          <label>
            メールアドレス
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            パスワード
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'ログイン中…' : 'ログイン'}</button>
        </form>
      </div>
    </main>
  );
}
