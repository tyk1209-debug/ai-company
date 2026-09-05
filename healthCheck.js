/**
 * healthCheck.js
 * パイプライン実行後の出力を検証する。
 *
 * 「動いているように見えて、実は記事が増えていない／同じ記事が出続けている」
 * という壊れ方を毎回オーナーに発見させてしまったため、機械で検知する。
 *
 * 前回コミット時点の data/posts.json と比較して異常を報告する。
 * 終了コードは常に0（デプロイ済みの成果物を壊さない）。
 * 結果は data/health.json に書き出し、Telegram通知に載せる。
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DATA_DIR = path.join(__dirname, "data");
const POSTS_PATH = path.join(DATA_DIR, "posts.json");

// 同じ記事が居座っていないか見る連続実行回数
const STALE_TOP_RUNS = 2;
// 新規0件が続いたら警告する連続実行回数
const NO_NEW_POSTS_RUNS = 2;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * 過去コミットの posts.json を読む。
 * @param {string} rev - git のリビジョン指定（例: "HEAD", "HEAD~1"）
 * @returns {Array|null}
 */
function readPostsAtRev(rev) {
  try {
    const raw = execSync(`git show ${rev}:data/posts.json`, {
      maxBuffer: 1024 * 1024 * 200,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString("utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function linkKey(post) {
  return ((post && post.link) || "").trim().toLowerCase();
}

function newestPost(posts) {
  return [...posts]
    .filter((p) => p.titleJa && p.titleJa.trim())
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))[0] || null;
}

/**
 * 記事総数が減っていないか。
 * 180日で過去記事を物理削除していた事故（2026-07-22）の再発検知。
 */
function checkPostCount(current, previous, warnings) {
  if (!previous) return;
  if (current.length < previous.length) {
    warnings.push(
      `記事が減っている: ${previous.length}件 -> ${current.length}件（${previous.length - current.length}件消失）`
    );
  }
}

/**
 * 公開済み記事が消えていないか。
 *
 * 総数だけ見ていると、3件消えて6件増えた回を「増えている」と誤判定する。
 * 実際 2026-07-22 の記事削除事故は総数が増えていたため見逃せた。
 * リンク単位で前回との差を取り、1件でも消えていれば異常として報告する。
 */
function checkRemovedPosts(current, previous, warnings) {
  if (!previous) return;
  const currentLinks = new Set(current.map(linkKey));
  const removed = previous.filter((p) => linkKey(p) && !currentLinks.has(linkKey(p)));
  if (removed.length > 0) {
    const sample = removed
      .slice(0, 3)
      .map((p) => (p.titleJa || p.title || "").slice(0, 30))
      .join(" / ");
    warnings.push(`公開済み記事が消えている: ${removed.length}件（${sample}）`);
  }
}

/**
 * 新規記事が出ているか。
 * フィード死亡やスコア閾値の締めすぎで供給が止まる事故の検知。
 */
function checkNewPosts(current, history, warnings) {
  const previous = history[0];
  if (!previous) return 0;

  const prevLinks = new Set(previous.map(linkKey));
  const added = current.filter((p) => !prevLinks.has(linkKey(p))).length;

  if (added === 0) {
    let quietRuns = 1;
    for (let i = 0; i < history.length - 1; i++) {
      const older = new Set(history[i + 1].map(linkKey));
      if (history[i].some((p) => !older.has(linkKey(p)))) break;
      quietRuns++;
    }
    if (quietRuns >= NO_NEW_POSTS_RUNS) {
      warnings.push(`新規記事が${quietRuns}回連続で0件。フィードか選抜条件を確認すること`);
    }
  }
  return added;
}

/**
 * トップ記事が入れ替わっているか。
 * 同じ記事が再翻訳されて9回連続トップに居座った事故（2026-08〜09）の再発検知。
 */
function checkTopPostRotation(current, history, warnings) {
  const top = newestPost(current);
  if (!top) {
    warnings.push("公開可能な記事が1件も無い（titleJaが全て空）");
    return null;
  }

  let sameRuns = 0;
  for (const past of history) {
    const pastTop = newestPost(past);
    if (pastTop && linkKey(pastTop) === linkKey(top)) sameRuns++;
    else break;
  }

  if (sameRuns >= STALE_TOP_RUNS) {
    warnings.push(
      `トップ記事が${sameRuns + 1}回連続で同じ: 「${(top.titleJa || "").slice(0, 40)}」`
    );
  }
  return top;
}

/**
 * 同じ記事が別レコードとして重複していないか。
 * リンク重複と、翻訳し直しで生まれる酷似タイトルの両方を見る。
 */
function checkDuplicates(current, warnings) {
  const seen = new Map();
  for (const p of current) {
    const key = linkKey(p);
    if (!key) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dupLinks = [...seen.entries()].filter(([, n]) => n > 1);
  if (dupLinks.length > 0) {
    warnings.push(`同一リンクの記事が重複: ${dupLinks.length}件`);
  }

  // 直近20件のうち、元タイトルが同じものが複数あれば再公開を疑う
  const recent = [...current]
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, 20);
  const byTitle = new Map();
  for (const p of recent) {
    const t = (p.title || "").trim().toLowerCase();
    if (!t) continue;
    byTitle.set(t, (byTitle.get(t) || 0) + 1);
  }
  const dupTitles = [...byTitle.entries()].filter(([, n]) => n > 1);
  if (dupTitles.length > 0) {
    warnings.push(`直近20件に同じ元記事が重複: ${dupTitles.length}件`);
  }
}

/**
 * 設定したフィードが実際に記事を返しているか。
 *
 * 2026-08 時点で22ソース中9つが恒常的に0件を返しており、
 * BIM中核ソースの供給が落ちたまま誰も気づけなかった。
 * 記事数の増減では出ない壊れ方なので、取得段階で直接見る。
 *
 * @param {Array} rawNews   - data/raw_news.json の中身
 * @param {Array} feedList  - feeds.js の定義
 */
function checkFeedHealth(rawNews, feedList, warnings) {
  if (!Array.isArray(rawNews) || !Array.isArray(feedList) || feedList.length === 0) return;

  const alive = new Set(rawNews.map((a) => (a.source || "").trim()).filter(Boolean));
  const dead = feedList.map((f) => f.name).filter((name) => !alive.has(name));

  if (dead.length > 0) {
    warnings.push(`記事を返さなかったフィード ${dead.length}/${feedList.length}件: ${dead.join(", ")}`);
  }
}

/**
 * 未来日付の記事が無いか。
 * 発行日に実行時刻を入れる類のバグで、記事が不当にトップ固定されるのを防ぐ。
 */
function checkFutureDates(current, warnings) {
  const limit = Date.now() + 24 * 60 * 60 * 1000;
  const future = current.filter((p) => p.pubDate && new Date(p.pubDate).getTime() > limit);
  if (future.length > 0) {
    warnings.push(`発行日が未来の記事: ${future.length}件`);
  }
}

function main() {
  const current = readJson(POSTS_PATH);
  if (!Array.isArray(current)) {
    console.error("[health] data/posts.json を読めなかった");
    fs.writeFileSync(
      path.join(DATA_DIR, "health.json"),
      JSON.stringify({ ok: false, warnings: ["posts.json を読めない"] }, null, 2),
      "utf8"
    );
    return;
  }

  // 直近3回分の履歴と比較する
  const history = ["HEAD", "HEAD~1", "HEAD~2"]
    .map(readPostsAtRev)
    .filter(Array.isArray);

  const warnings = [];
  checkPostCount(current, history[0], warnings);
  checkRemovedPosts(current, history[0], warnings);
  const added = checkNewPosts(current, history, warnings);
  const top = checkTopPostRotation(current, history, warnings);
  checkDuplicates(current, warnings);
  checkFutureDates(current, warnings);
  checkFeedHealth(readJson(path.join(DATA_DIR, "raw_news.json")), require("./feeds.js"), warnings);

  const report = {
    ok: warnings.length === 0,
    checkedAt: new Date().toISOString(),
    totalPosts: current.length,
    newPosts: added,
    topPost: top ? (top.titleJa || "").slice(0, 60) : null,
    warnings,
  };

  fs.writeFileSync(path.join(DATA_DIR, "health.json"), JSON.stringify(report, null, 2), "utf8");

  console.log("=".repeat(60));
  console.log(`[health] 記事総数 ${report.totalPosts}件 / 新規 ${report.newPosts}件`);
  console.log(`[health] トップ: ${report.topPost || "(なし)"}`);
  if (warnings.length === 0) {
    console.log("[health] 異常なし");
  } else {
    console.log(`[health] 警告 ${warnings.length}件:`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  console.log("=".repeat(60));
}

if (require.main === module) {
  main();
}

module.exports = { checkPostCount, checkRemovedPosts, checkNewPosts, checkFeedHealth, checkTopPostRotation, checkDuplicates, checkFutureDates };
