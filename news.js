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
const { scoreNews } = require("./scoreNews.js");
const { generatePosts } = require("./generatePost.js");
const { applyAffiliateLinks } = require("./affiliateLinks.js");
const { postArticles } = require("./postToX.js");
const { summarizeArticles } = require("./summarize.js");
const { recordPost } = require("./analytics.js");
const { checkArticles } = require("./hallucination-checker.js");

const DATA_DIR = path.join(__dirname, "data");
const MIN_SCORE_SELECTED = 6;
const TOP_DISPLAY_COUNT = 10;
const ENABLE_X_AUTO_POST = false;

const parser = new Parser({ timeout: 12000 });

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

  const scored = scoreNews(deduped);
  saveJson("scored_news.json", scored);

  const selected = scored.filter((a) => {
    if (a.score < MIN_SCORE_SELECTED) return false;
    if (!a.pubDate) return true;
    const ageDays = (Date.now() - new Date(a.pubDate).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= 90;
  });
  saveJson("selected_posts.json", selected);

  const summarized = await summarizeArticles(selected, { limit: 5 });
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

  const posts = applyAffiliateLinks(generatePosts(passed));
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

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Pipeline failed:", err);
    process.exit(1);
  });
