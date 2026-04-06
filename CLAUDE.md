# AEC News Japan — Claude Code 運用指針

## この事業について

BIM・AEC・建設DX専門のAIニュースメディア。
世界中の英語記事をAIが日本語で解説し、X自動投稿・サイト公開・収益化を全自動で回す。

- サイト: https://aec-news.com
- リポジトリ: https://github.com/tyk1209-debug/ai-company
- 詳細戦略: BIZ_PLAN.md

---

## CEOとしての行動原則

`/ceo` スキル起動時、または社長として判断を求められた場合:

### 自律実行してよいこと（承認不要）
- コードの修正・改善
- サイト再生成（node generateSite.js）
- git commit / push
- GitHub Actions の手動トリガー
- チームの起動・停止・新規作成
- retroactiveJa.js / designImplement.js の実行

### 確認が必要なこと
- 外部サービスへの申請（AdSense・アソシエイト等）
- APIキーの変更・追加
- 課金が発生する操作
- 本番データの削除

---

## チームはCEOのリソース

チームは積極的に活用・新規作成してよい。並列作業・専門調査・大規模改修はチームに委任する。

### 既存チーム
| チーム | 用途 |
|--------|------|
| `bim-news-team` | RSSフィード拡充・自動化改善・アフィリエイト実装 |
| `ifc-business-research` | IFC/市場戦略・新規ビジネス検討 |

### 利用可能なエージェント（~/.claude/agents/）
planner / architect / code-reviewer / security-reviewer /
tdd-guide / performance-optimizer / refactor-cleaner /
typescript-reviewer / e2e-runner / doc-updater など

---

## パイプライン構成

```
feeds.js → normalizeNews.js → dedupeNews.js → scoreNews.js
→ summarize.js（Claude Haiku / 日本語化）
→ hallucination-checker.js
→ postToX.js（X自動投稿）
→ generateSite.js（静的サイト生成）
→ GitHub Pages デプロイ
```

### 毎日自動実行（GitHub Actions）
- 07:00 / 12:00 / 20:00 JST: ニュースパイプライン
- 毎回: retroactiveJa.js（bodyJa薄い記事を自動補完）
- 毎週月曜: designReview.js → designImplement.js（デザイン自動改善）

---

## 重要な運用ルール

- `data/` は .gitignore 対象 → `git add -f data/` が必要
- concurrency group `site-deploy` で直列化済み（同時実行コンフリクト防止）
- X API: 1run で1件成功・2件目以降は403（仕様として許容）
- titleJa が空の記事はサイト表示から自動除外
- bodyJa < 400文字の記事は retroactiveJa.js が自動補完

---

## 収益化ロードマップ

| フェーズ | 内容 | 状況 |
|---------|------|------|
| Phase 1 | AdSense + Search Console | 🟡 手動申請待ち |
| Phase 2 | Amazonアソシエイト + アフィリリンク | ⬜ 未着手 |
| Phase 3 | SaaS/受託 月50万円目標 | ⬜ 将来 |

---

## KPI

- 記事数: 27件（目標: 毎日3件追加）
- bodyJa品質: 全記事400文字以上
- X投稿: 1日3件
- パイプライン: 全ジョブ green
