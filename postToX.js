/**
 * postToX.js
 * X（Twitter）自動投稿モジュール
 *
 * X API v2 を使って投稿候補記事を自動投稿する。
 * APIキーが未設定の場合はドライランモード（コンソール出力のみ）で動作する。
 *
 * 使い方:
 *   const { postTweet, postArticles } = require("./postToX.js");
 *   await postArticles(articles, { dryRun: true });
 */

const { TwitterApi } = require("twitter-api-v2");

// ─────────────────────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────────────────────

const SITE_BASE_URL = "https://aec-news.com";

// ─────────────────────────────────────────────────────────────
// 記事URL生成ユーティリティ
// ─────────────────────────────────────────────────────────────

/**
 * 記事タイトルからスラグを生成する（generateSite.js と同じロジック）
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

/**
 * 記事のAEC News Japan正規URLを返す
 * @param {object} article - slug または title を持つ記事オブジェクト
 * @returns {string}
 */
function buildArticleUrl(article) {
  const slug = article.slug || slugify(article.title || "");
  if (!slug) return SITE_BASE_URL + "/";
  return `${SITE_BASE_URL}/posts/${slug}.html`;
}

/**
 * postText にサイトURLが含まれていない場合は末尾に追記して返す
 * @param {string} postText
 * @param {object} article
 * @returns {string}
 */
function ensureArticleUrl(postText, article) {
  if (!postText) return postText;
  // すでにサイトURLが含まれていればそのまま返す
  if (postText.includes(SITE_BASE_URL)) return postText;
  const url = buildArticleUrl(article);
  return postText + "\n" + url;
}

// ─────────────────────────────────────────────────────────────
// クライアント初期化
// ─────────────────────────────────────────────────────────────

function hasCredentials() {
  return !!(
    process.env.X_API_KEY &&
    process.env.X_API_SECRET &&
    process.env.X_ACCESS_TOKEN &&
    process.env.X_ACCESS_TOKEN_SECRET
  );
}

function createClient() {
  if (!hasCredentials()) {
    return null;
  }

  return new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });
}

// ─────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// 投稿関数
// ─────────────────────────────────────────────────────────────

/**
 * 1件のテキストをXに投稿する
 * @param {string} text - 投稿するテキスト
 * @param {object} [options={}]
 * @param {boolean} [options.dryRun] - true の場合はコンソール出力のみ
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
async function postTweet(text, options = {}) {
  const isDryRun = options.dryRun || !hasCredentials();

  if (isDryRun) {
    console.log("[DRY RUN] 投稿しません（本番投稿は X_API_KEY を設定してください）");
    console.log("投稿内容:");
    console.log("---");
    console.log(text);
    console.log("---");
    return { success: true, id: "dry-run" };
  }

  try {
    const client = createClient();
    const result = await client.v2.tweet(text);
    console.log(`[POST OK] id=${result.data.id}`);
    return { success: true, id: result.data.id };
  } catch (err) {
    if (err.code === 429 || (err.data && err.data.status === 429)) {
      console.error("[RATE LIMIT] レートリミットに達しました。この投稿をスキップします。");
      return { success: false, error: "rate_limit" };
    }

    if (err.code === 401 || err.code === 403) {
      console.error("[AUTH ERROR] 認証に失敗しました。X API の認証情報を確認してください。");
      console.error(`  詳細: ${err.message}`);
      return { success: false, error: "auth_error" };
    }

    console.error(`[ERROR] 投稿に失敗しました: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * 投稿候補の記事を順番に投稿する
 * @param {object[]} articles - postText プロパティを持つ記事の配列
 * @param {object} [options={}]
 * @param {boolean} [options.dryRun=true] - ドライランモード（デフォルト: true）
 * @param {number} [options.intervalMs=30000] - 投稿間隔（ミリ秒）
 * @param {number} [options.limit=3] - 1回の実行で投稿する最大件数
 * @returns {Promise<{posted: number, skipped: number, results: object[]}>}
 */
async function postArticles(articles, options = {}) {
  const {
    dryRun = true,
    intervalMs = 30000,
    limit = 3,
  } = options;

  const targets = articles.slice(0, limit);
  const results = [];
  let posted = 0;
  let skipped = 0;

  console.log(`\n投稿開始: ${targets.length}件（dryRun=${dryRun}）\n`);

  for (let i = 0; i < targets.length; i++) {
    const article = targets[i];

    if (!article.postText) {
      console.log(`[SKIP] postText がありません: ${article.title || "(タイトルなし)"}`);
      skipped++;
      results.push({ title: article.title, success: false, error: "no_postText" });
      continue;
    }

    console.log(`── ${i + 1}/${targets.length} ──────────────────────────`);

    const tweetText = ensureArticleUrl(article.postText, article);
    const result = await postTweet(tweetText, { dryRun });

    results.push({ title: article.title, ...result });

    if (result.success) {
      posted++;
    } else {
      skipped++;
    }

    // 最後の投稿以外はインターバルを入れる
    if (i < targets.length - 1) {
      console.log(`  → ${intervalMs / 1000}秒待機...\n`);
      await sleep(intervalMs);
    }
  }

  console.log(`\n投稿完了: 成功=${posted} スキップ=${skipped}`);

  return { posted, skipped, results };
}

/**
 * イベント情報をXに投稿する
 * @param {object} event - events.json の1エントリ
 * @param {object} [options={}]
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
async function postEvent(event, options = {}) {
  const { dryRun = true } = options;

  const SITE_EVENTS_URL = `${SITE_BASE_URL}/events.html`;

  // 開催日テキスト
  let dateText = '';
  if (event.date) {
    const d = new Date(event.date);
    if (!isNaN(d.getTime())) {
      dateText = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  const locationText = event.location ? `📍${event.location}` : '';
  const dateStr      = dateText ? `📅${dateText}` : '';

  const text = [
    `🏗️ イベント情報`,
    ``,
    event.title,
    ``,
    [dateStr, locationText].filter(Boolean).join(' '),
    ``,
    `詳細→ ${event.url || SITE_EVENTS_URL}`,
    `#BIM #AEC #建設DX`,
  ].join('\n');

  return postTweet(text, { dryRun });
}

module.exports = { postTweet, postArticles, postEvent };

// ─────────────────────────────────────────────────────────────
// テスト用コード（直接実行時のみ動作）
// ─────────────────────────────────────────────────────────────
//
// 使い方:
//   node postToX.js
//
// if (require.main === module) {
//   (async () => {
//     // 単体テスト: ドライランで1件投稿
//     console.log("=== 単体テスト: postTweet ===");
//     await postTweet("テスト投稿です #BIM #建設DX\nhttps://example.com", { dryRun: true });
//
//     // 複数記事テスト
//     console.log("\n=== 複数記事テスト: postArticles ===");
//     const testArticles = [
//       { title: "BIM最新情報", postText: "BIMの最新情報👇\n\nBIM最新情報\n\nhttps://example.com\n\n#BIM #建設DX" },
//       { title: "AI建設DX", postText: "建設DX / AIの最新動向👇\n\nAI建設DX\n\nhttps://example.com/2\n\n#AI #建設DX" },
//       { title: "Revitアップデート", postText: "Revitの最新情報👇\n\nRevitアップデート\n\nhttps://example.com/3\n\n#Revit #BIM" },
//     ];
//     await postArticles(testArticles, { dryRun: true, intervalMs: 1000, limit: 2 });
//   })();
// }
