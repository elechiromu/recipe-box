# Recipe Box

iPhone と Mac の両方で使える自分専用のレシピ帳（React + Firebase + Vercel / PWA）。

- 写真付きでレシピを登録（iPhoneの写真は自動で縮小して保存）
- 人数を変えると材料の分量を自動換算（大さじ・分数・g/mlに対応、「少々」「適量」はそのまま）
- WebレシピのURLを貼るだけで材料・手順を取り込み
- 調理モード：手順を大きく1つずつ表示、画面スリープ防止、「10分」などからタイマー、スワイプ/矢印キーで移動
- 材料名で検索（冷蔵庫の中身から探せる）、タグ・お気に入りで絞り込み
- オフラインでも保存済みレシピを閲覧可能

const firebaseConfig = {
  apiKey: "AIzaSyC6YXigc5pdtg1YhkRGwEMeOEfBqVSvK74",
  authDomain: "recipe-box-b175e.firebaseapp.com",
  projectId: "recipe-box-b175e",
  storageBucket: "recipe-box-b175e.firebasestorage.app",
  messagingSenderId: "821376102470",
  appId: "1:821376102470:web:e05f0013fb15c487b79a47",
  measurementId: "G-JVT9SM81R6"

## セットアップ

### 1. Firebase

1. [Firebase コンソール](https://console.firebase.google.com/)で新規プロジェクトを作成
2. **Authentication** →「メール/パスワード」を有効化
3. **Authentication → Users →「ユーザーを追加」** で自分のアカウントを作成
4. **Authentication → 設定 → ユーザーアクション** で「作成（登録）を有効にする」のチェックを外す
   （自分以外がアカウントを作れないようにするため）
5. **Firestore Database** と **Storage** を作成（ロケーションは `asia-northeast1` 推奨）
6. ルールをデプロイ：
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add   # 作成したプロジェクトを選ぶ
   firebase deploy --only firestore:rules,storage
   ```
7. **プロジェクトの設定 → マイアプリ** でウェブアプリを追加し、設定値を控える

### 2. ローカルで動かす

```bash
cp .env.example .env.local   # 設定値を記入
npm install
npm run dev
```

※ Web取り込み（`/api/import`）は Vercel の関数なので、ローカルで試すときは `npx vercel dev` を使います。

### 3. Vercel にデプロイ

1. GitHub に新しいリポジトリを作って push（**他のアプリのリポジトリと取り違えないよう注意**）
2. Vercel で Import → Framework は Vite が自動選択されます
3. Environment Variables に `.env.example` の全項目を登録
4. Firebase → Authentication → 設定 → **承認済みドメイン** に Vercel のドメインを追加

### 4. iPhone / Mac に入れる

- **iPhone**：Safari で開く → 共有ボタン →「ホーム画面に追加」
- **Mac**：Safari で開く →「ファイル」→「Dockに追加」（Chromeならアドレスバーのインストールボタン）

## 使い方のコツ

- 材料は1行に「名前 分量」。`■たれ` のように■で始めると見出し
- 手順は1行に1つ。`【焼く】` だけの行は手順の見出し
- 取り込んだ写真は元サイトの画像を参照しています。消えると困るものは自分の写真に差し替えを

## テスト

```bash
npm test   # 分量換算・材料の分割・レシピ取り込みの解析
```

## 構成

```
api/import.js          Web取り込み（ログイン確認・社内IP遮断・サイズ/時間制限つき）
shared/                クライアントとAPIで共用する純粋ロジック（換算・解析）
src/components/        画面（一覧・詳細・編集・調理モード・ログイン）
src/lib/recipes.js     Firestore / Storage の読み書き
firestore.rules        users/{uid}/recipes を本人のみ読み書き可
storage.rules          本人のみ・画像・5MB未満
```
