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
const { summarizeArticle } = require("./summarize.js");

const POSTS_PATH = path.join(__dirname, "data", "posts.json");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────────────────────

async function main() {
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));

  // titleJa が空、または bodyJa が薄い（1200文字未満）、または【日本への影響】セクションが無い記事を抽出
  // （Phase 2 でAdSense審査品質要件に合わせて閾値を 400 → 1200 に引き上げ、日本への影響セクション必須化）
  // 週次まとめ（slugが"weekly-"で始まる）はスキップ
  const targets = posts.filter((p) => {
    if (p.slug && p.slug.startsWith("weekly-")) return false;
    const missingTitle = !p.titleJa || p.titleJa.trim() === "";
    const body = p.bodyJa || "";
    const thinBody = body.length < 1200;
    const missingJapanSection = !body.includes("【日本への影響】");
    return missingTitle || thinBody || missingJapanSection;
  });

  console.log(`[retroactiveJa] 対象記事数: ${targets.length} / 全${posts.length}件`);

  if (targets.length === 0) {
    console.log("[retroactiveJa] 全記事が既に日本語化済みです。");
  } else {
    // OAuth tokenをAPIキーとして使用（Claude Code環境向けフォールバック）
    if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      console.log("[retroactiveJa] CLAUDE_CODE_OAUTH_TOKEN を ANTHROPIC_API_KEY として使用します");
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

      // summarizeArticle は本文取得・Claude API呼び出し・titleJa/bodyJa生成をすべて行う
      const updated = await summarizeArticle(article);

      if (updated.titleJa && updated.titleJa.trim() !== "") {
        const idx = posts.findIndex(
          (p) => (p.link && p.link === article.link) || (p.slug && p.slug === article.slug)
        );
        if (idx !== -1) {
          posts[idx] = {
            ...posts[idx],
            titleJa: updated.titleJa,
            bodyJa:  updated.bodyJa || "",
          };
          console.log(`[retroactiveJa]   titleJa: ${updated.titleJa}`);
          console.log(`[retroactiveJa]   bodyJa: ${(updated.bodyJa || "").length}文字`);
          successCount++;
        }
      } else {
        console.warn(`[retroactiveJa]   titleJa 生成失敗 — スキップ`);
        failCount++;
      }

      // レートリミット対策
      if (i < targets.length - 1) await sleep(500);
    }

    // posts.json を上書き保存
    fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), "utf-8");
    console.log(`\n[retroactiveJa] posts.json 更新完了 (成功: ${successCount}, 失敗: ${failCount})`);
  }

  // サイト再生成
  console.log("\n[retroactiveJa] generateSite.js を実行します...");
  try {
    execSync("node generateSite.js", { stdio: "inherit", cwd: __dirname });
    console.log("[retroactiveJa] サイト再生成完了");
  } catch (err) {
    console.error("[retroactiveJa] generateSite.js 実行エラー:", err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[retroactiveJa] 予期しないエラー:", err);
  process.exit(1);
});
