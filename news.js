/**
 * news.js
 * Main news pipeline for AEC News Japan.
 *
 * Flow:
 *   fetch RSS/raw -> dedupe -> score -> summarize -> quality check
 *   -> generate site post candidates -> save data artifacts
 *
 * Auto-posting to X is intentionally disabled.
 */

const fs = require("fs");
const path = require("path");
const Parser = require("rss-parser");

const feeds = require("./feeds.js");
const { scrapeJapaneseSources } = require("./scraper.js");
const { normalizeArticles } = require("./normalizeNews.js");
const { dedupeNews } = require("./dedupeNews.js");
const { scoreNews, refineCategories } = require("./scoreNews.js");
const { adjustScoreWeights } = require("./autopilot.js");
const { generatePosts } = require("./generatePost.js");
const { applyAffiliateLinks } = require("./affiliateLinks.js");
const { postArticles } = require("./postToX.js");
const { summarizeArticles } = require("./summarize.js");
const { recordPost } = require("./analytics.js");
const { checkArticles } = require("./hallucination-checker.js");

const DATA_DIR = path.join(__dirname, "data");
const MIN_SCORE_SELECTED = 6;

// 更新ペース: 3日おきの実行で最大5件。最低ラインは1件。
// ネタがある回は5件まで出す。無い回は1〜2件でよく、無理に埋めない。
// 翻訳は上限+1件ぶん回す。relevance判定やハルシネーションチェックで
// 落ちる分を見込んだ予備枠。
const MAX_NEW_POSTS_PER_RUN = 5;
const SUMMARIZE_LIMIT = MAX_NEW_POSTS_PER_RUN + 1;
const TOP_DISPLAY_COUNT = 10;
const ENABLE_X_AUTO_POST = false;

// 配信元によって通る UA が割れる。
//   - Autodesk AEC Blog / Graphisoft: UA無しだと 403（ブラウザUAが必要）
//   - buildingSMART International:    ブラウザUAだと 403（UA無しが必要）
// どちらか一方に固定すると必ずどこかが恒常的に0件になるため、
// ブラウザUA → UA無し の順で試すフォールバック方式にする。
const FEED_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FEED_PARSERS = [
  new Parser({
    timeout: 12000,
    headers: {
      "User-Agent": FEED_USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  }),
  new Parser({ timeout: 12000 }),
];

/**
 * Merge freshly fetched posts with the existing posts.json to avoid losing
 * articles that have aged out of RSS feeds.
 *
 * @param {Array} freshPosts - Posts generated from the current pipeline run.
 * @param {string} existingPostsPath - Absolute path to the on-disk posts.json.
 * @returns {Array} Merged array: fresh posts first, then preserved historical ones.
 */
// 壊れた記事レコードの判定: titleJa空 & bodyJa空 のものは過去ログ汚染とみなして除外する。
// 翻訳途中で失敗したRSS残骸や、retroactiveJaが回り切らなかった records が
// thin contentとしてSEO・AdSense審査に悪影響を与えるのを防ぐ。
function isBrokenRecord(post) {
  const title = (post.titleJa || "").trim();
  const body = (post.bodyJa || "").trim();
  return (!title || title === "undefined") && body.length < 100;
}

// RSSにはナビゲーションや申込フォーム等の非記事ページが混入する
// （例: 「問い合わせ完了」「価格表（2022年第2四半期）」「当サイトについて」）。
// ソース信頼度で加点する以上、こうしたページが翻訳枠を食わないよう先に落とす。
const NON_ARTICLE_TITLE_PATTERNS = [
  /^(問い合わせ|お問い合わせ|お問合せ)/,
  /^(当サイト|このサイト)について/,
  /^価格表/,
  /^保護中[:：]/,
  /(メールフォーム|登録フォーム|申込フォーム)$/,
  /^(プライバシーポリシー|利用規約|会社概要|サイトマップ)/,
];

function isNonArticle(article) {
  const title = (article.title || "").trim();
  if (!title) return true;
  return NON_ARTICLE_TITLE_PATTERNS.some((re) => re.test(title));
}

function mergeWithExistingPosts(freshPosts, existingPostsPath) {
  let existingPosts = [];
  if (fs.existsSync(existingPostsPath)) {
    try {
      existingPosts = JSON.parse(fs.readFileSync(existingPostsPath, "utf8"));
    } catch { /* ignore parse errors */ }
  }

  // 過去ログから壊れた records を自己修復で除去
  const beforeCleanup = existingPosts.length;
  existingPosts = existingPosts.filter((p) => !isBrokenRecord(p));
  const removedBroken = beforeCleanup - existingPosts.length;
  if (removedBroken > 0) {
    console.log(`[self-heal] Removed ${removedBroken} broken record(s) from existing posts`);
  }

  // Build a lookup of existing posts by link for quick access
  const existingByLink = new Map(
    existingPosts.map((p) => [(p.link || "").trim().toLowerCase(), p])
  );

  // For fresh posts missing titleJa/bodyJa, inherit from the existing version if available.
  // This prevents re-fetched RSS articles from losing their previously generated translations.
  const enrichedFresh = freshPosts.map((p) => {
    const key = (p.link || "").trim().toLowerCase();
    const existing = existingByLink.get(key);
    if (!existing) return p;
    return {
      ...p,
      titleJa: p.titleJa && p.titleJa.trim() ? p.titleJa : (existing.titleJa || ""),
      bodyJa:  p.bodyJa  && p.bodyJa.trim()  ? p.bodyJa  : (existing.bodyJa  || ""),
    };
  });

  const freshLinks = new Set(enrichedFresh.map((p) => (p.link || "").trim().toLowerCase()));

  // 過去記事は期限で消さない（恒久アーカイブ）。
  // 以前は180日を超えた記事を posts.json から落としていたが、generateSite.js が
  // posts.json に無いページを posts/ から削除するため、公開済みURLが404化して
  // 被リンク・検索流入・回遊導線を失っていた（2026-07-22 に実害を確認）。
  // メディアとして過去記事はストック資産なので、重複リンク以外は全件維持する。
  const preserved = existingPosts.filter(
    (p) => !freshLinks.has((p.link || "").trim().toLowerCase())
  );

  return [...enrichedFresh, ...preserved];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function fetchFeed(feed) {
  let lastError = "unknown error";

  for (const feedParser of FEED_PARSERS) {
    try {
      const result = await feedParser.parseURL(feed.url);
      const articles = normalizeArticles(result.items || [], feed.name);
      return { ok: true, feed: feed.name, articles };
    } catch (err) {
      lastError = err.message;
    }
  }

  return { ok: false, feed: feed.name, error: lastError };
}

async function fetchAllFeeds() {
  const results = await Promise.all(feeds.map(fetchFeed));
  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const raw = succeeded.flatMap((r) => r.articles);
  return { succeeded, failed, raw };
}

function printSummary({ succeeded, failed, raw, deduped, selected }) {
  console.log("=".repeat(60));
  console.log("News Pipeline Summary");
  console.log(`  Feed success count : ${succeeded.length}`);
  console.log(`  Feed failure count : ${failed.length}`);
  console.log(`  Raw article count  : ${raw.length}`);
  console.log(`  Deduped count      : ${deduped.length}`);
  console.log(`  Selected count     : ${selected.length}`);
  console.log("=".repeat(60));

  if (failed.length > 0) {
    console.log("\nFailed feeds:");
    failed.forEach((f) => console.log(`  - ${f.feed} (${f.error})`));
  }
}

function printTopArticles(articles) {
  const top = articles.slice(0, TOP_DISPLAY_COUNT);

  if (top.length === 0) {
    console.log("\nNo selected articles were found.");
    return;
  }

  console.log(`\nTop ${top.length} selected articles\n`);

  top.forEach((article, i) => {
    const hits = Array.isArray(article.keywordHits)
      ? article.keywordHits.slice(0, 5).join(", ")
      : "";
    console.log(`${i + 1}. [${article.category}] [score:${article.score}] ${article.title}`);
    console.log(`   Source : ${article.source}`);
    console.log(`   Date   : ${article.pubDate || "unknown"}`);
    console.log(`   URL    : ${article.link}`);
    console.log(`   Hits   : ${hits || "none"}`);
    console.log("");
  });
}

function printPosts(articles) {
  const top = articles.slice(0, 5);
  if (top.length === 0) return;

  console.log("\nGenerated post candidates\n");
  top.forEach((article, i) => {
    console.log(`----- ${i + 1} -----`);
    console.log(article.postText);
    console.log("");
  });
}

async function maybeAutoPost(posts) {
  if (!ENABLE_X_AUTO_POST) {
    console.log("\n[X] Auto-posting is disabled. Generated candidate copy only.");
    return { posted: 0, skipped: 0, results: [] };
  }

  const dryRun = process.env.DRY_RUN !== "false";
  const analyticsFile = path.join(DATA_DIR, "analytics.json");
  const analyticsData = fs.existsSync(analyticsFile)
    ? JSON.parse(fs.readFileSync(analyticsFile, "utf8"))
    : { posts: [] };

  const postedLinks = new Set(
    analyticsData.posts
      .filter((p) => p.success && !p.dryRun)
      .map((p) => p.link)
  );

  const approvedPosts = posts.filter((p) => !postedLinks.has(p.link));

  if (approvedPosts.length === 0) {
    console.log("\n[X] No new articles approved for posting.");
    return { posted: 0, skipped: 0, results: [] };
  }

  console.log(
    `\n[X] Ready to post ${approvedPosts.length} article(s). Skipped duplicates: ${posts.length - approvedPosts.length}`
  );

  const postResult = await postArticles(approvedPosts, { dryRun, limit: 1 });

  postResult.results.forEach((result, i) => {
    if (approvedPosts[i]) {
      recordPost(approvedPosts[i], { ...result, dryRun });
    }
  });

  return postResult;
}

async function main() {
  console.log("\nStarting BIM/AEC news pipeline...\n");

  ensureDataDir();

  const { succeeded, failed, raw: rssRaw } = await fetchAllFeeds();

  let scraped = [];
  try {
    scraped = await scrapeJapaneseSources();
    console.log(`[scraper] fetched ${scraped.length} item(s) from Japanese sources`);
  } catch (err) {
    console.error(`[scraper] failed: ${err.message}`);
  }

  const raw = [...rssRaw, ...scraped];
  saveJson("raw_news.json", raw);

  const deduped = dedupeNews(raw);
  saveJson("deduped_news.json", deduped);

  const weights = adjustScoreWeights();
  const scored = scoreNews(deduped, weights);
  saveJson("scored_news.json", scored);

  // 採否は relevanceScore（記事そのものの価値・時間で減らない）で判定する。
  // score は freshness を含むので並べ替え専用。
  const selected = scored.filter((a) => {
    if (isNonArticle(a)) return false;
    if ((a.relevanceScore ?? a.score) < MIN_SCORE_SELECTED) return false;
    if (!a.pubDate) return true;
    const ageDays = (Date.now() - new Date(a.pubDate).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= 90;
  });
  saveJson("selected_posts.json", selected);

  // 翻訳枠（limit）に新着記事が確実に入るよう、pubDate 降順で並び替えてから渡す。
  // selected_posts.json は score 順のまま保存して下流デバッグの可読性を保つ。
  const summarizeQueue = [...selected].sort((a, b) => {
    const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return tb - ta;
  });
  const summarizedRaw = await summarizeArticles(summarizeQueue, { limit: SUMMARIZE_LIMIT });
  // 日本語本文を含めてカテゴリを再判定（英語要約では拾えないRevit等を救済）
  const summarized = refineCategories(summarizedRaw);
  saveJson("summarized_news.json", summarized);

  const irrelevant = summarized.filter((a) => a.relevant === false);
  if (irrelevant.length > 0) {
    console.log(`\n[relevance] blocked ${irrelevant.length} article(s)`);
    irrelevant.forEach((a) => console.log(`  - ${(a.title || "").slice(0, 60)}`));
  }

  const relevant = summarized.filter((a) => a.relevant !== false);
  const { passed, blocked } = await checkArticles(relevant);

  if (blocked.length > 0) {
    console.log(`\n[hallucination-check] blocked ${blocked.length} article(s)`);
    blocked.forEach((a) => console.log(`  - ${(a.title || "").slice(0, 60)}`));
  }

  // 1回の実行で公開するのは MAX_NEW_POSTS_PER_RUN 件まで。
  // summarizeQueue は pubDate 降順なので、残るのは常に最も新しい記事。
  const publishing = passed.slice(0, MAX_NEW_POSTS_PER_RUN);
  if (passed.length > publishing.length) {
    console.log(
      `\n[pace] ${passed.length}件中 ${publishing.length}件を公開（残りは次回以降の候補に戻す）`
    );
  }

  const freshPosts = applyAffiliateLinks(generatePosts(publishing));

  // Merge with existing posts.json to preserve articles that aged out of RSS feeds
  // 過去記事も日本語本文を含めてカテゴリを再判定（誤分類の是正）
  const posts = refineCategories(mergeWithExistingPosts(freshPosts, path.join(DATA_DIR, "posts.json")));
  saveJson("posts.json", posts);

  const postResult = await maybeAutoPost(posts);

  printSummary({ succeeded, failed, raw, deduped, selected });
  printTopArticles(selected);
  printPosts(posts);

  if (ENABLE_X_AUTO_POST) {
    const dryRun = process.env.DRY_RUN !== "false";
    console.log(
      `X posting: posted=${postResult.posted} skipped=${postResult.skipped} (${dryRun ? "dry-run" : "live"})`
    );
  } else {
    console.log("X posting: disabled");
  }

  console.log(`\nData directory: ${DATA_DIR}`);
  console.log("=".repeat(60));
}

// require された時点でパイプラインが走ると data/*.json を意図せず上書きするため、
// 直接実行されたときだけ起動する。
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Pipeline failed:", err);
      process.exit(1);
    });
}
