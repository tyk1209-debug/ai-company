/**
 * retroactiveJa.js
 * titleJa / bodyJa が未設定の既存記事を一括で日本語化する
 *
 * 使い方:
 *   node retroactiveJa.js
 */

if (require("fs").existsSync("./.env")) {
  require("dotenv").config();
}

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { generateXPostBody } = require("./summarize.js");
const { fetchArticleText }  = require("./fetchArticle.js");

const POSTS_PATH = path.join(__dirname, "data", "posts.json");

// ─────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getArticleBody(article) {
  if (article.link) {
    try {
      const fetched = await fetchArticleText(article.link);
      if (fetched && fetched.length > 200) return fetched;
    } catch (_) {
      // フォールバックへ
    }
  }
  return (article.summary || "").slice(0, 1500);
}

// ─────────────────────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────────────────────

async function main() {
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));

  // titleJa が空またはない記事を抽出（週次まとめ等は既存なのでスキップ）
  const targets = posts.filter(
    (p) => !p.titleJa || p.titleJa.trim() === ""
  );

  console.log(`[retroactiveJa] 対象記事数: ${targets.length} / 全${posts.length}件`);

  if (targets.length === 0) {
    console.log("[retroactiveJa] 全記事が既に日本語化済みです。");
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[retroactiveJa] ERROR: ANTHROPIC_API_KEY が設定されていません。");
    process.exit(1);
  }

  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < targets.length; i++) {
    const article = targets[i];
    console.log(`\n[retroactiveJa] (${i + 1}/${targets.length}) ${article.title?.slice(0, 60)}`);

    const body = await getArticleBody(article);
    console.log(`[retroactiveJa]   本文取得: ${body.length}文字`);

    const result = await generateXPostBody(article, body);

    if (result.titleJa && result.titleJa.trim() !== "") {
      // posts 配列内の対象記事を更新
      const idx = posts.findIndex((p) => p === article || (p.slug && p.slug === article.slug) || (p.link && p.link === article.link));
      if (idx !== -1) {
        posts[idx] = {
          ...posts[idx],
          titleJa: result.titleJa,
          bodyJa:  result.bodyJa,
        };
        console.log(`[retroactiveJa]   titleJa: ${result.titleJa}`);
        successCount++;
      }
    } else {
      console.warn(`[retroactiveJa]   titleJa 生成失敗 — スキップ`);
      failCount++;
    }

    // レートリミット対策: 最後の1件以外はウェイト
    if (i < targets.length - 1) await sleep(500);
  }

  // posts.json を上書き保存
  fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), "utf-8");
  console.log(`\n[retroactiveJa] posts.json 更新完了 (成功: ${successCount}, 失敗: ${failCount})`);

  // サイト再生成
  console.log("\n[retroactiveJa] generateSite.js を実行します...");
  try {
    execSync("node generateSite.js", { stdio: "inherit", cwd: __dirname });
    console.log("[retroactiveJa] サイト再生成完了");
  } catch (err) {
    console.error("[retroactiveJa] generateSite.js 実行エラー:", err.message);
    process.exit(1);
  }

  console.log(`\n[retroactiveJa] 完了: ${successCount}件の記事を日本語化しました。`);
}

main().catch((err) => {
  console.error("[retroactiveJa] 予期しないエラー:", err);
  process.exit(1);
});
