/**
 * news.js
 * メイン実行ファイル
 *
 * 処理フロー:
 *   RSS取得 → 正規化(raw) → 重複除去(deduped) → スコアリング(scored) → 投稿候補抽出(selected) → X投稿文生成(posts)
 *
 * 実行:
 *   node news.js
 */

const fs     = require("fs");
const path   = require("path");
const Parser = require("rss-parser");

const feeds                       = require("./feeds.js");
const { scrapeJapaneseSources }   = require("./scraper.js");
const { normalizeArticles } = require("./normalizeNews.js");
const { dedupeNews }        = require("./dedupeNews.js");
const { scoreNews }         = require("./scoreNews.js");
const { generatePosts }      = require("./generatePost.js");
const { applyAffiliateLinks} = require("./affiliateLinks.js");
const { postArticles }       = require("./postToX.js");
const { summarizeArticles }  = require("./summarize.js");
const { recordPost }         = require("./analytics.js");
const { checkArticles }      = require("./hallucination-checker.js");
const { reviewPosts, sendMessage } = require("./telegram.js");

const DATA_DIR           = path.join(__dirname, "data");
const MIN_SCORE_SELECTED = 6;   // 投稿候補にする最低スコア
const TOP_DISPLAY_COUNT  = 10;  // コンソールに表示する件数

const parser = new Parser({ timeout: 12000 });

// ─────────────────────────────────────────────────────────────
// ファイル保存
// ─────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ─────────────────────────────────────────────────────────────
// RSS取得
// ─────────────────────────────────────────────────────────────

async function fetchFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    const articles = normalizeArticles(result.items || [], feed.name);
    return { ok: true, feed: feed.name, articles };
  } catch (err) {
    return { ok: false, feed: feed.name, error: err.message };
  }
}

async function fetchAllFeeds() {
  const results = await Promise.all(feeds.map(fetchFeed));

  const succeeded = results.filter((r) => r.ok);
  const failed    = results.filter((r) => !r.ok);
  const raw       = succeeded.flatMap((r) => r.articles);

  return { succeeded, failed, raw };
}

// ─────────────────────────────────────────────────────────────
// コンソール出力
// ─────────────────────────────────────────────────────────────

function printSummary({ succeeded, failed, raw, deduped, selected }) {
  console.log("─".repeat(60));
  console.log("【収集結果サマリー】");
  console.log(`  成功フィード数   : ${succeeded.length}`);
  console.log(`  失敗フィード数   : ${failed.length}`);
  console.log(`  取得件数         : ${raw.length}`);
  console.log(`  重複除去後件数   : ${deduped.length}`);
  console.log(`  投稿候補件数     : ${selected.length}`);
  console.log("─".repeat(60));

  if (failed.length > 0) {
    console.log("\n【取得失敗フィード】");
    failed.forEach((f) => console.log(`  ✗ ${f.feed}  (${f.error})`));
  }
}

function printTopArticles(articles) {
  const top = articles.slice(0, TOP_DISPLAY_COUNT);

  if (top.length === 0) {
    console.log("\n投稿候補が見つかりませんでした。");
    return;
  }

  console.log(`\n【投稿候補 TOP ${top.length}】\n`);

  top.forEach((article, i) => {
    const hits = article.keywordHits.slice(0, 5).join(", ");
    console.log(`${i + 1}. [${article.category}] [score:${article.score}] ${article.title}`);
    console.log(`   媒体: ${article.source}`);
    console.log(`   日時: ${article.pubDate || "不明"}`);
    console.log(`   URL : ${article.link}`);
    console.log(`   ヒット: ${hits || "なし"}`);
    console.log("");
  });
}

function printPosts(articles) {
  const top = articles.slice(0, 5);
  if (top.length === 0) return;

  console.log("\n【X投稿文 プレビュー（上位5件）】\n");
  top.forEach((article, i) => {
    console.log(`── ${i + 1}件目 ──────────────────────────`);
    console.log(article.postText);
    console.log("");
  });
}

// ─────────────────────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("\nBIM/AEC ニュース収集を開始します...\n");

  ensureDataDir();

  // 1. RSS取得 & 正規化
  const { succeeded, failed, raw: rssRaw } = await fetchAllFeeds();

  // 1b. スクレイピング（RSSなし日本語ソース）をマージ
  let scraped = [];
  try {
    scraped = await scrapeJapaneseSources();
    console.log(`[scraper] ${scraped.length}件取得 (mlit.go.jp)`);
  } catch (err) {
    console.error(`[scraper] 取得エラー: ${err.message}`);
  }
  const raw = [...rssRaw, ...scraped];
  saveJson("raw_news.json", raw);

  // 2. 重複除去
  const deduped = dedupeNews(raw);
  saveJson("deduped_news.json", deduped);

  // 3. スコアリング & カテゴリ分類
  const scored = scoreNews(deduped);
  saveJson("scored_news.json", scored);

  // 4. 投稿候補抽出 (スコア >= 6 かつ 90日以内の記事のみ)
  const selected = scored.filter((a) => {
    if (a.score < MIN_SCORE_SELECTED) return false;
    if (!a.pubDate) return true;
    const ageDays = (Date.now() - new Date(a.pubDate).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= 90;
  });
  saveJson("selected_posts.json", selected);

  // 5. 日本語要約（ANTHROPIC_API_KEY がある場合のみ動作。なければスキップ）
  const summarized = await summarizeArticles(selected, { limit: 5 });
  saveJson("summarized_news.json", summarized);

  // 6. ハルシネーション検証（HIGHリスクを自動ブロック）
  const { passed, blocked } = await checkArticles(summarized);
  if (blocked.length > 0) {
    console.log(`\n[ハルシネーション検証] ${blocked.length}件を自動ブロックしました`);
    blocked.forEach((a) => console.log(`  ❌ ${a.title?.slice(0, 60)}`));
  }

  // 7. X投稿文生成 + アフィリエイトリンク付加
  const posts = applyAffiliateLinks(generatePosts(passed));
  saveJson("posts.json", posts);

  // 8. Telegramレビュー（設定済みの場合のみ。未設定なら全件投稿）
  const dryRun = process.env.DRY_RUN !== "false";
  let approvedPosts = posts;

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID && !dryRun) {
    const { approved, feedback } = await reviewPosts(posts);

    // フィードバック付き記事をClaudeで修正再生成
    const fixed = [];
    for (const { post, text } of feedback) {
      console.log(`[Telegram] フィードバック修正中: "${text}"`);
      const fixedSummary = await require("./summarize.js").summarizeWithFeedback(post, text);
      const fixedPost = applyAffiliateLinks(generatePosts([fixedSummary]))[0];
      fixed.push(fixedPost);

      if (process.env.TELEGRAM_BOT_TOKEN) {
        await sendMessage(
          `🔧 <b>修正済み投稿</b>\n\n${fixedPost.postText}\n\n承認する場合はこのまま投稿されます`
        );
      }
    }

    approvedPosts = [...approved, ...fixed];
  } else if (dryRun) {
    console.log("[DRY RUN] Telegramレビューはスキップ（ドライランモード）");
  } else {
    console.log("[Telegram] 環境変数未設定 — レビューなしで全件投稿");
  }

  // 9. X投稿
  const postResult = await postArticles(approvedPosts, { dryRun, limit: 3 });

  // 10. 投稿結果を analytics に記録
  postResult.results.forEach((result, i) => {
    if (approvedPosts[i]) recordPost(approvedPosts[i], { ...result, dryRun });
  });

  // 11. 出力
  printSummary({ succeeded, failed, raw, deduped, selected });
  printTopArticles(selected);
  printPosts(posts);
  console.log(`X投稿: 成功=${postResult.posted} スキップ=${postResult.skipped} (${dryRun ? "ドライラン" : "本番"})`);

  console.log(`\n保存先: ${DATA_DIR}`);
  console.log("─".repeat(60));
}

main().catch((err) => {
  console.error("予期しないエラーが発生しました:", err);
  process.exit(1);
});
