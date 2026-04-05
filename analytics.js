/**
 * analytics.js
 * エンゲージメント分析モジュール
 *
 * 投稿記事の記録・カテゴリ別集計・キーワード分析を行う。
 * 将来的にX APIのインプレッション/いいね数を取得して改善サイクルを回す土台。
 *
 * 使い方:
 *   const { recordPost, getCategoryStats, getTopKeywords, printAnalyticsReport } = require("./analytics.js");
 *   recordPost(article, postResult);
 *   printAnalyticsReport();
 *
 * コマンドライン:
 *   node analytics.js   # レポートを表示
 */

const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────────
// データファイルパス
// ─────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "data");
const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");

// ─────────────────────────────────────────────────────────────
// データ読み書き
// ─────────────────────────────────────────────────────────────

function loadData() {
  if (!fs.existsSync(ANALYTICS_FILE)) {
    return { posts: [] };
  }

  try {
    const raw = fs.readFileSync(ANALYTICS_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data.posts)) {
      return { posts: [] };
    }
    return data;
  } catch {
    return { posts: [] };
  }
}

function saveData(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ─────────────────────────────────────────────────────────────
// 投稿記録
// ─────────────────────────────────────────────────────────────

/**
 * 投稿した記事を記録する
 * @param {object} article - scoreNews.js処理済み記事（category, keywordHits, score等を含む）
 * @param {object} postResult - { success, id, dryRun }
 */
function recordPost(article, postResult) {
  const data = loadData();

  const record = {
    id: postResult.id || Date.now().toString(),
    postedAt: new Date().toISOString(),
    title: article.title || "",
    link: article.link || "",
    category: article.category || "OTHER",
    score: article.score || 0,
    keywordHits: article.keywordHits || [],
    dryRun: !!postResult.dryRun,
    success: !!postResult.success,
    xPostId: postResult.id || null,
  };

  const newData = {
    posts: [...data.posts, record],
  };

  saveData(newData);
  return record;
}

// ─────────────────────────────────────────────────────────────
// 分析: カテゴリ別統計
// ─────────────────────────────────────────────────────────────

/**
 * カテゴリ別の投稿数・成功率を集計して返す
 * @returns {object} カテゴリ名をキーとする統計オブジェクト
 */
function getCategoryStats() {
  const { posts } = loadData();
  const stats = {};

  for (const post of posts) {
    const cat = post.category || "OTHER";
    if (!stats[cat]) {
      stats[cat] = { posted: 0, success: 0 };
    }
    stats[cat].posted++;
    if (post.success) {
      stats[cat].success++;
    }
  }

  const result = {};
  for (const [cat, s] of Object.entries(stats)) {
    const rate = s.posted > 0 ? ((s.success / s.posted) * 100).toFixed(1) : "0.0";
    result[cat] = {
      posted: s.posted,
      success: s.success,
      successRate: `${rate}%`,
    };
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// 分析: 上位キーワード
// ─────────────────────────────────────────────────────────────

/**
 * 上位キーワードを集計して返す（何回投稿に登場したか）
 * @param {number} [limit=10] - 取得件数
 * @returns {Array<{keyword: string, count: number}>}
 */
function getTopKeywords(limit = 10) {
  const { posts } = loadData();
  const counts = {};

  for (const post of posts) {
    const hits = post.keywordHits || [];
    for (const kw of hits) {
      counts[kw] = (counts[kw] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// レポート表示
// ─────────────────────────────────────────────────────────────

/**
 * 分析レポートをコンソールに表示する
 */
function printAnalyticsReport() {
  const { posts } = loadData();

  console.log("\n══════════════════════════════════════════");
  console.log("  Analytics Report");
  console.log("══════════════════════════════════════════\n");

  console.log(`Total posts recorded: ${posts.length}`);

  const dryRunCount = posts.filter((p) => p.dryRun).length;
  const liveCount = posts.length - dryRunCount;
  console.log(`  Live: ${liveCount}  |  Dry Run: ${dryRunCount}\n`);

  // カテゴリ別統計
  const catStats = getCategoryStats();
  const catEntries = Object.entries(catStats);

  if (catEntries.length > 0) {
    console.log("── Category Stats ──────────────────────");
    const catHeader = "Category".padEnd(18) + "Posted".padStart(8) + "Success".padStart(9) + "Rate".padStart(10);
    console.log(catHeader);
    console.log("-".repeat(catHeader.length));

    for (const [cat, s] of catEntries) {
      console.log(
        cat.padEnd(18) +
        String(s.posted).padStart(8) +
        String(s.success).padStart(9) +
        s.successRate.padStart(10)
      );
    }
    console.log();
  }

  // 上位キーワード
  const topKw = getTopKeywords(10);

  if (topKw.length > 0) {
    console.log("── Top Keywords ────────────────────────");
    for (let i = 0; i < topKw.length; i++) {
      const { keyword, count } = topKw[i];
      console.log(`  ${String(i + 1).padStart(2)}. ${keyword.padEnd(24)} ${count} posts`);
    }
    console.log();
  }

  if (posts.length === 0) {
    console.log("No data yet. Run news pipeline to start recording.\n");
  }

  console.log("══════════════════════════════════════════\n");
}

// ─────────────────────────────────────────────────────────────
// エクスポート
// ─────────────────────────────────────────────────────────────

module.exports = {
  recordPost,
  getCategoryStats,
  getTopKeywords,
  printAnalyticsReport,
};

// ─────────────────────────────────────────────────────────────
// CLI実行
// ─────────────────────────────────────────────────────────────

if (require.main === module) {
  printAnalyticsReport();
}
