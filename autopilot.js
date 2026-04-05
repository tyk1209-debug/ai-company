/**
 * autopilot.js
 * 自律オーケストレーター - 自律AI会社の脳
 *
 * analytics.json のデータを読み取り、うまくいっている投稿パターンを強化し、
 * うまくいっていないパターンを減らす自己改善ループを実装する。
 *
 * 自己改善ループ:
 *   投稿 → 記録(analytics) → 分析 → スコア調整 → 次の投稿品質UP
 *
 * コマンドライン:
 *   node autopilot.js status   # ステータスレポート表示
 *   node autopilot.js health   # ヘルスチェック
 *   node autopilot.js weights  # 現在のスコア補正係数を表示
 */

const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────────
// パス定義
// ─────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "data");
const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");
const FEEDS_PATH = path.join(__dirname, "feeds.js");

// ─────────────────────────────────────────────────────────────
// カテゴリ定義（scoreNews.js と同じ順序）
// ─────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  "REVIT",
  "ARCHICAD",
  "GLOOBE",
  "IFC",
  "BIM_AI",
  "BIM_ECOSYSTEM",
  "AI_DX",
  "OTHER",
];

// ─────────────────────────────────────────────────────────────
// データ読み込み
// ─────────────────────────────────────────────────────────────

function loadAnalytics() {
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

// ─────────────────────────────────────────────────────────────
// adjustScoreWeights()
// analytics.json を読み込み、カテゴリ別の成功率から
// scoreNews.js のスコアに補正係数を計算して返す
// ─────────────────────────────────────────────────────────────

function adjustScoreWeights() {
  const { posts } = loadAnalytics();
  const weights = {};

  // 初期値: 全カテゴリ 1.0
  for (const cat of ALL_CATEGORIES) {
    weights[cat] = 1.0;
  }

  if (posts.length === 0) {
    return weights;
  }

  // 直近30件の投稿を対象にする
  const recent = posts.slice(-30);
  const totalRecent = recent.length;

  // カテゴリ別の投稿数と成功数を集計
  const catStats = {};
  for (const post of recent) {
    const cat = post.category || "OTHER";
    if (!catStats[cat]) {
      catStats[cat] = { count: 0, success: 0 };
    }
    catStats[cat].count++;
    if (post.success) {
      catStats[cat].success++;
    }
  }

  // 平均投稿数（カテゴリあたり）
  const activeCats = Object.keys(catStats).length;
  const avgCount = activeCats > 0 ? totalRecent / activeCats : 1;

  for (const cat of ALL_CATEGORIES) {
    const stat = catStats[cat];

    if (!stat) {
      // まだ投稿がないカテゴリ → 標準係数
      weights[cat] = 1.0;
      continue;
    }

    // 投稿数が多い = 需要あり → ブースト
    const volumeRatio = stat.count / avgCount;

    // 成功率による補正
    const successRate = stat.count > 0 ? stat.success / stat.count : 0;

    // 補正係数の計算:
    //   ベース 1.0
    //   + 投稿数ボーナス (平均超え → 最大 +0.2)
    //   + 成功率ボーナス (高成功率 → 最大 +0.2)
    //   - 低成功率ペナルティ (50%未満 → 最大 -0.2)
    let weight = 1.0;

    if (volumeRatio > 1.0) {
      weight += Math.min((volumeRatio - 1.0) * 0.2, 0.2);
    }

    if (successRate >= 0.8) {
      weight += 0.2;
    } else if (successRate >= 0.6) {
      weight += 0.1;
    } else if (successRate < 0.5 && stat.count >= 3) {
      weight -= 0.1;
    }

    // 範囲制限: 0.7 ~ 1.4
    weights[cat] = Math.round(Math.max(0.7, Math.min(1.4, weight)) * 100) / 100;
  }

  return weights;
}

// ─────────────────────────────────────────────────────────────
// generateStatusReport()
// 現在の稼働状況をまとめたテキストを返す
// ─────────────────────────────────────────────────────────────

function generateStatusReport() {
  const { posts } = loadAnalytics();
  const now = new Date();
  const lines = [];

  lines.push("");
  lines.push("══════════════════════════════════════════════════════");
  lines.push("  Autopilot Status Report");
  lines.push("══════════════════════════════════════════════════════");
  lines.push("");

  // 今日の投稿数
  const todayStr = now.toISOString().slice(0, 10);
  const todayPosts = posts.filter(
    (p) => p.postedAt && p.postedAt.slice(0, 10) === todayStr
  );
  lines.push(`  Today's posts:      ${todayPosts.length}`);

  // 今週の投稿数 (月曜始まり)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const weekPosts = posts.filter(
    (p) => p.postedAt && new Date(p.postedAt) >= monday
  );
  lines.push(`  This week's posts:  ${weekPosts.length}`);

  // 全体
  lines.push(`  Total posts:        ${posts.length}`);
  lines.push("");

  // カテゴリ別内訳
  const catCounts = {};
  for (const post of posts) {
    const cat = post.category || "OTHER";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }

  const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  if (catEntries.length > 0) {
    lines.push("  Category breakdown:");
    for (const [cat, count] of catEntries) {
      const pct = posts.length > 0
        ? ((count / posts.length) * 100).toFixed(1)
        : "0.0";
      lines.push(`    ${cat.padEnd(18)} ${String(count).padStart(4)} posts  (${pct}%)`);
    }
    lines.push("");
  }

  // 次回スケジュール (scheduler.js の設定に基づく)
  const scheduleHours = [7, 12, 20]; // JST
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentHourJST = jstNow.getUTCHours();
  const nextRun = scheduleHours.find((h) => h > currentHourJST);
  const nextRunStr = nextRun !== undefined
    ? `${String(nextRun).padStart(2, "0")}:00 JST today`
    : `${String(scheduleHours[0]).padStart(2, "0")}:00 JST tomorrow`;
  lines.push(`  Next scheduled run: ${nextRunStr}`);

  // 推定月間投稿数
  if (posts.length >= 3) {
    const sortedDates = posts
      .filter((p) => p.postedAt)
      .map((p) => new Date(p.postedAt).getTime())
      .sort((a, b) => a - b);

    if (sortedDates.length >= 2) {
      const spanMs = sortedDates[sortedDates.length - 1] - sortedDates[0];
      const spanDays = spanMs / (1000 * 60 * 60 * 24);
      const postsPerDay = spanDays > 0 ? sortedDates.length / spanDays : 0;
      const estimatedMonthly = Math.round(postsPerDay * 30);
      lines.push(`  Estimated monthly:  ~${estimatedMonthly} posts`);
    }
  } else {
    lines.push("  Estimated monthly:  (not enough data)");
  }

  // 自己改善ステータス
  const weights = adjustScoreWeights();
  const boosted = Object.entries(weights)
    .filter(([, w]) => w > 1.0)
    .map(([cat, w]) => `${cat}(${w})`);
  const reduced = Object.entries(weights)
    .filter(([, w]) => w < 1.0)
    .map(([cat, w]) => `${cat}(${w})`);

  lines.push("");
  lines.push("  Self-improvement loop:");
  lines.push(`    Boosted:  ${boosted.length > 0 ? boosted.join(", ") : "none"}`);
  lines.push(`    Reduced:  ${reduced.length > 0 ? reduced.join(", ") : "none"}`);

  lines.push("");
  lines.push("══════════════════════════════════════════════════════");
  lines.push("");

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// checkHealth()
// システムの健全性チェック
// ─────────────────────────────────────────────────────────────

function checkHealth() {
  const warnings = [];

  // feeds.js が読めるか
  try {
    require(FEEDS_PATH);
  } catch (err) {
    warnings.push(`feeds.js cannot be loaded: ${err.message}`);
  }

  // data/ ディレクトリが存在するか
  if (!fs.existsSync(DATA_DIR)) {
    warnings.push("data/ directory does not exist (will be created on first run)");
  }

  // 環境変数チェック
  const envVars = [
    { key: "X_API_KEY", label: "X API Key" },
    { key: "X_API_SECRET", label: "X API Secret" },
    { key: "X_ACCESS_TOKEN", label: "X Access Token" },
    { key: "X_ACCESS_SECRET", label: "X Access Secret" },
  ];

  for (const { key, label } of envVars) {
    if (!process.env[key]) {
      warnings.push(`${label} (${key}) is not set`);
    }
  }

  // ANTHROPIC_API_KEY (要約用、オプショナル)
  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push("ANTHROPIC_API_KEY is not set (summarization will be skipped)");
  }

  // 最後の実行から24時間以上経過していないか
  const { posts } = loadAnalytics();
  if (posts.length > 0) {
    const lastPost = posts[posts.length - 1];
    if (lastPost.postedAt) {
      const lastTime = new Date(lastPost.postedAt).getTime();
      const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
      if (hoursSince > 24) {
        warnings.push(
          `Last post was ${Math.round(hoursSince)} hours ago (>24h, may indicate pipeline stall)`
        );
      }
    }
  } else {
    warnings.push("No posts recorded yet (first run pending)");
  }

  return {
    healthy: warnings.length === 0,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// CLI フォーマット
// ─────────────────────────────────────────────────────────────

function printWeights() {
  const weights = adjustScoreWeights();

  console.log("");
  console.log("══════════════════════════════════════════════════════");
  console.log("  Score Weight Adjustments (self-improvement loop)");
  console.log("══════════════════════════════════════════════════════");
  console.log("");

  const header =
    "  Category".padEnd(22) +
    "Weight".padStart(8) +
    "  Effect";
  console.log(header);
  console.log("  " + "-".repeat(48));

  for (const [cat, w] of Object.entries(weights)) {
    let effect = "standard";
    if (w > 1.0) effect = "BOOST";
    if (w < 1.0) effect = "REDUCE";

    console.log(
      `  ${cat.padEnd(20)}${String(w).padStart(6)}  ${effect}`
    );
  }

  console.log("");
  console.log("  How it works:");
  console.log("    - Analyses last 30 posts from analytics.json");
  console.log("    - Categories with high volume + success rate get boosted");
  console.log("    - Categories with low success rate get reduced");
  console.log("    - Weight range: 0.7 (min) to 1.4 (max)");
  console.log("");
}

function printHealth() {
  const { healthy, warnings } = checkHealth();

  console.log("");
  console.log("══════════════════════════════════════════════════════");
  console.log("  System Health Check");
  console.log("══════════════════════════════════════════════════════");
  console.log("");

  if (healthy) {
    console.log("  Status: HEALTHY");
    console.log("  All systems operational.");
  } else {
    console.log(`  Status: ${warnings.length} WARNING(S)`);
    console.log("");
    for (let i = 0; i < warnings.length; i++) {
      console.log(`  ${i + 1}. ${warnings[i]}`);
    }
  }

  console.log("");
  console.log("══════════════════════════════════════════════════════");
  console.log("");
}

function printUsage() {
  console.log("");
  console.log("Usage: node autopilot.js <command>");
  console.log("");
  console.log("Commands:");
  console.log("  status   Show current operational status report");
  console.log("  health   Run system health check");
  console.log("  weights  Show current score weight adjustments");
  console.log("");
}

// ─────────────────────────────────────────────────────────────
// エクスポート
// ─────────────────────────────────────────────────────────────

module.exports = {
  adjustScoreWeights,
  generateStatusReport,
  checkHealth,
};

// ─────────────────────────────────────────────────────────────
// CLI 実行
// ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case "status":
      console.log(generateStatusReport());
      break;
    case "health":
      printHealth();
      break;
    case "weights":
      printWeights();
      break;
    default:
      printUsage();
      break;
  }
}
