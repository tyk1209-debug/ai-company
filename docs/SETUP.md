# AI会社 セットアップガイド（一度だけ必要）

## ステップ1: GitHubリポジトリの設定

1. このリポジトリをGitHubにpush
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit"
   gh repo create ai-company --private --source=. --push
   ```
2. Settings > Secrets and variables > Actions で以下を登録:
   - `ANTHROPIC_API_KEY` — Claude API キー
   - `X_API_KEY` — X API キー
   - `X_API_SECRET` — X API シークレット
   - `X_ACCESS_TOKEN` — X アクセストークン
   - `X_ACCESS_TOKEN_SECRET` — X アクセストークンシークレット
3. Settings > Variables > Actions で設定:
   - `DRY_RUN` = `false` ← 本番投稿を有効にする（デフォルトは `true` で安全）

---

## ステップ2: アフィリエイト登録（収益化）

1. Amazonアソシエイト: https://affiliate.amazon.co.jp/
2. A8.net: https://www.a8.net/
   - Udemy / 建設系SaaSを検索して提携申請

## ステップ3: affiliateLinks.js にIDを設定

`affiliateLinks.js` の URL プレースホルダを実際のアフィリエイトIDに置き換える。

---

## ステップ4: Google Cloud TTS 設定（動画ナレーション）

1. https://console.cloud.google.com にアクセス
2. プロジェクトを作成
3. 「APIとサービス」→「ライブラリ」→「Cloud Text-to-Speech API」を有効化
4. 「APIとサービス」→「認証情報」→「APIキーを作成」
5. GitHub Secrets に登録:
   - `GOOGLE_CLOUD_API_KEY` = 取得したAPIキー

---

## ステップ5: YouTube 自動アップロード設定

### 5-1. OAuth2クライアントID作成

1. https://console.cloud.google.com にアクセス（ステップ4と同じプロジェクト）
2. 「APIとサービス」→「ライブラリ」→「YouTube Data API v3」を有効化
3. 「APIとサービス」→「認証情報」→「OAuthクライアントIDを作成」
   - アプリケーションの種類: **デスクトップアプリ**
4. `YOUTUBE_CLIENT_ID` と `YOUTUBE_CLIENT_SECRET` をメモ

### 5-2. リフレッシュトークン取得（初回1回だけ）

以下をブラウザで開いてGoogleアカウントで認証:
```
https://accounts.google.com/o/oauth2/auth?client_id=【CLIENT_ID】&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/youtube.upload&response_type=code&access_type=offline
```

認証後に表示される「コード」を使って以下を実行:
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=【認証コード】" \
  -d "client_id=【CLIENT_ID】" \
  -d "client_secret=【CLIENT_SECRET】" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" \
  -d "grant_type=authorization_code"
```

レスポンスの `refresh_token` をコピー。

### 5-3. GitHub Secrets に登録

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

---

## ステップ6: 手動テスト実行

1. GitHub > Actions > "AI News Autopilot" を選択
2. "Run workflow" ボタンをクリック（DRY_RUN=true のまま）
3. ログを確認して正常動作を検証
4. 問題なければ Variables で `DRY_RUN` を `false` に変更

---

## 完了後は完全自動稼働

| 時刻 | 処理 |
|------|------|
| 毎日 07:00 JST | ニュース収集 → X自動投稿 |
| 毎日 12:00 JST | ニュース収集 → X自動投稿 |
| 毎日 20:00 JST | ニュース収集 → X自動投稿 → **YouTube動画生成・アップロード** |

GitHub Actions 無料枠: 月2,000分（十分余裕あり）
