# AEC News Japan — 引き継ぎメモ

最終更新: 2026-04-07

## 1. 現在の方針

- サイトの基本構造は `ニュース → 解説 → 学習/参考アイテム`。
- 専門メディアとしての信頼感を優先し、派手さより可読性と実務価値を重視。
- Amazon アソシエイトは「売り込み」ではなく「理解を深める導線」として使う。
- `X` の自動投稿は停止済み。サイト内の `Xでシェア` は残している。
- Search Console は登録・サイトマップ送信・インデックス登録リクエスト済み。反映待ち前提。

## 2. 今日までの重要変更

### 解説ハブ・回遊

- `guides/` 配下に基礎解説を整備。
- 現在ある解説記事:
  - `guides/bim.html`
  - `guides/revit.html`
  - `guides/archicad.html`
  - `guides/openbim.html`
  - `guides/ifc.html`
  - `guides/bim-ai.html`
  - `guides/cde.html`
  - `guides/bim-manager.html`
- `guides/index.html` を追加し、基礎解説の独立ハブ化を実施。
- トップページは基礎解説を全件ではなく一部表示に変更。
- ニュース記事には `この内容を理解するならこちら` を追加し、関連する解説記事へ誘導。

### 記事ページ改善

- 全記事ページで共通テンプレートを改善。
- 追加済み:
  - `TL;DR（3行でわかる要点）`
  - `なぜ重要か`
  - `実務でどう使うか`
  - 関連記事導線
  - 基礎解説導線
  - 参考アイテム導線
- `業界への影響` と `実務への影響` の内容重複はテンプレート側で抑制。
- `【...】` 形式だけでなく `背景:` のようなコロン形式のセクションも分解できるよう修正済み。
- 比較表の簡易レンダリング、図解カードの簡易レンダリングをテンプレートに追加。
- `meta description` は本文の日本語要約を優先するよう変更済み。

### 収益導線

- Amazon アソシエイトID: `aecnewsjapan-22`
- カテゴリ/記事内に `参考アイテム` を配置。
- 書籍だけでなく、文脈に合う実務アイテムも許容する運用へ変更済み。
- ただし、基本思想は「記事理解を深めるものだけを出す」こと。
- 追加済みの主な導線:
  - Revit 書籍
  - Archicad 書籍
  - GLOOBE 書籍
  - BIM/FM 書籍
  - 建設DX 書籍
  - SpaceMouse
  - MX Master 3S
  - Meta Quest 3
  - ワークステーション/モニター/GPU など一部ハードウェア

### SEO

- favicon をルートに配置済み。
- 構造化データ、OG/Twitter メタ、description を全体的に強化済み。
- `robots.txt` の `Disallow: /assets/` は削除済み。

### フィード

- Graphisoft Community 日本語 Insights をフィード対象に追加済み。
- 利用中の RSS:
  - `https://community.graphisoft.com/rss/board?board.id=gs-insights-jp`

### 手動追加記事

- `Graphisoft Bluebeam` ウェビナー記事を手動追加済み:
  - `posts/graphisoft-bluebeam-webinar-jp.html`

## 3. 今日の直近コミット

- `4cef4a8` fix: strengthen explainer hero readability
- `a441d3a` fix: improve guide hero contrast
- `61ddd95` feat: strengthen article seo ux and monetization
- `3316052` feat: add Graphisoft Insights Japan feed
- `a3a8c06` feat: publish Graphisoft Bluebeam webinar article
- `af33004` feat: add workstation and hardware affiliate items
- `e77d5b8` feat: align monetization and learning paths
- `9b583ea` feat: strengthen guide hub and learning navigation

## 4. 変更ファイルの中心

- テンプレート/生成:
  - `generateSite.js`
  - `affiliateLinks.js`
  - `feeds.js`
- データ:
  - `data/posts.json`
- 生成物:
  - `index.html`
  - `guides/*.html`
  - `posts/*.html`
  - `categories/*.html`
  - `sitemap.xml`
  - `robots.txt`

## 5. いまの注意点

- `data/` は `.gitignore` 対象なので、手動追加記事をコミットする際は `git add -f data/posts.json` が必要。
- `CLAUDE.md` の KPI に `X投稿` が残っているが、現実の運用では `X自動投稿` は止めている。今後整理候補。
- 参考アイテムは増えてきたため、将来的には `書籍 / 実務ツール` の整理を検討してよい。
- 解説ページのヒーローは可読性改善済みだが、画像次第ではさらに微調整余地あり。

## 6. 次にやると良いこと

1. 記事ごとの `tags` を増やして、検索意図に合う内部リンク精度を上げる。
2. FAQ セクションと FAQ schema を解説記事から順に追加する。
3. Amazon 導線を記事テーマごとにさらに整理し、意図が弱いアイテムは減らす。
4. `CLAUDE.md` の古い運用前提（特に X まわり）を現状に合わせて更新する。

