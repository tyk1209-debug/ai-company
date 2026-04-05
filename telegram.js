/**
 * telegram.js
 * Telegramを使った投稿レビュー・フィードバックモジュール
 *
 * 返信フォーマット（1行1件）:
 *   1 OK               → 承認
 *   2 修正: 〇〇が間違い → Claudeが修正して再生成
 *   3 NG               → 却下
 *   all                → 全件承認
 *   skip               → 全件スキップ
 */

const https = require("https");

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const REVIEW_TIMEOUT_MS = 30 * 60 * 1000; // 30分

// ─────────────────────────────────────────────────────────────
// Telegram API 低レベル呼び出し
// ─────────────────────────────────────────────────────────────

function telegramRequest(method, params) {
  return new Promise((resolve, reject) => {
    const body    = JSON.stringify(params);
    const options = {
      hostname: "api.telegram.org",
      path:     `/bot${TOKEN}/${method}`,
      method:   "POST",
      headers:  {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function sendMessage(text) {
  if (!TOKEN || !CHAT_ID) return;
  return telegramRequest("sendMessage", {
    chat_id:    CHAT_ID,
    text,
    parse_mode: "HTML",
  });
}

// ─────────────────────────────────────────────────────────────
// 返信待機（ロングポーリング）
// ─────────────────────────────────────────────────────────────

async function waitForReply(timeoutMs = REVIEW_TIMEOUT_MS) {
  // 現在の最新 update_id を取得してオフセットに使う
  const initial = await telegramRequest("getUpdates", { timeout: 0 });
  let offset = 0;
  if (initial.result && initial.result.length > 0) {
    offset = initial.result[initial.result.length - 1].update_id + 1;
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = Math.min(30, Math.floor((deadline - Date.now()) / 1000));
    if (remaining <= 0) break;

    const res = await telegramRequest("getUpdates", {
      offset,
      timeout:         remaining,
      allowed_updates: ["message"],
    });

    if (res.result && res.result.length > 0) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        if (update.message && update.message.text) {
          return update.message.text.trim();
        }
      }
    }
  }

  return null; // タイムアウト
}

// ─────────────────────────────────────────────────────────────
// 返信テキストのパース
// ─────────────────────────────────────────────────────────────

/**
 * 返信テキストを解析して各記事の判定を返す
 * @param {string} replyText
 * @param {number} postCount
 * @returns {{ index: number, verdict: 'ok'|'fix'|'ng', feedback: string }[]}
 */
function parseReply(replyText, postCount) {
  const text = replyText.trim().toLowerCase();

  // "all" → 全件承認
  if (text === "all" || text === "全部" || text === "全件") {
    return Array.from({ length: postCount }, (_, i) => ({
      index:    i,
      verdict:  "ok",
      feedback: "",
    }));
  }

  // "skip" → 全件スキップ
  if (text === "skip" || text === "スキップ") {
    return [];
  }

  const results = [];

  for (const rawLine of replyText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // 行頭の番号を取得（例: "1 OK", "2: 修正して", "3"）
    const numMatch = line.match(/^(\d+)/);
    if (!numMatch) continue;

    const num   = parseInt(numMatch[1], 10);
    const index = num - 1;
    if (index < 0 || index >= postCount) continue;

    const rest = line.slice(numMatch[0].length).replace(/^[\s:：]+/, "").trim();

    // 判定ロジック
    if (!rest || /^(ok|OK|はい|yes|承認|良い|いい)$/i.test(rest)) {
      results.push({ index, verdict: "ok", feedback: "" });
    } else if (/^(ng|NG|だめ|ダメ|却下|no|不可)/i.test(rest)) {
      results.push({ index, verdict: "ng", feedback: rest });
    } else {
      // それ以外のテキストはすべて「修正フィードバック」として扱う
      const feedback = rest.replace(/^(修正|fix|change|直して)[：:。\s]*/i, "").trim();
      results.push({ index, verdict: "fix", feedback });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// メイン: レビューリクエスト送信 & 結果返却
// ─────────────────────────────────────────────────────────────

/**
 * 投稿候補をTelegramに送ってレビューを受け、結果を返す
 * @param {object[]} posts - generatePost 済みの記事配列
 * @returns {Promise<{ approved: object[], feedback: { post: object, text: string }[] }>}
 */
async function reviewPosts(posts) {
  if (!TOKEN || !CHAT_ID) {
    console.log("[Telegram] 環境変数未設定 — レビューをスキップして全件投稿");
    return { approved: posts, feedback: [] };
  }

  // ── 通知メッセージ作成 ──
  const lines = [
    "📋 <b>投稿レビュー依頼</b>",
    `${posts.length}件の投稿候補があります\n`,
  ];

  posts.forEach((p, i) => {
    const title   = (p.title || "").slice(0, 55);
    const date    = p.pubDate ? new Date(p.pubDate).toLocaleDateString("ja-JP") : "日付不明";
    const risk    = p.hallucinationRisk ? ` ⚠️ ${p.hallucinationRisk.score}` : "";

    lines.push(`<b>${i + 1}.</b> [${p.category}] スコア:${p.score}${risk}`);
    lines.push(`${title}…（${date}）`);
    lines.push(`${p.link}`);
    if (p.hallucinationRisk && p.hallucinationRisk.flags.length > 0) {
      lines.push(`　→ 要確認: ${p.hallucinationRisk.flags.join(" / ")}`);
    }
    lines.push("");
  });

  lines.push("──────────────────────");
  lines.push("返信フォーマット（1行1件）:");
  lines.push("<code>1 OK</code>  承認");
  lines.push("<code>2 修正: バージョンは2026</code>  フィードバック付き修正");
  lines.push("<code>3 NG</code>  却下");
  lines.push("<code>all</code>  全件承認 / <code>skip</code>  全件スキップ");
  lines.push("\n⏰ 30分以内に返信がない場合はスキップ");

  await sendMessage(lines.join("\n"));
  console.log("[Telegram] レビュー依頼を送信しました。30分以内に返信してください...");

  // ── 返信待機 ──
  const replyText = await waitForReply();

  if (!replyText) {
    await sendMessage("⏰ タイムアウト: 今回の投稿はスキップされました");
    console.log("[Telegram] タイムアウト — 投稿スキップ");
    return { approved: [], feedback: [] };
  }

  const verdicts = parseReply(replyText, posts.length);

  if (verdicts.length === 0) {
    await sendMessage("⏭ スキップしました");
    return { approved: [], feedback: [] };
  }

  const approved  = [];
  const feedback  = [];
  const summaryLines = ["📊 <b>レビュー結果</b>\n"];

  for (const { index, verdict, feedback: fb } of verdicts) {
    const post = posts[index];
    if (!post) continue;

    if (verdict === "ok") {
      approved.push(post);
      summaryLines.push(`✅ ${index + 1}. 承認`);
    } else if (verdict === "fix") {
      feedback.push({ post, text: fb });
      summaryLines.push(`🔧 ${index + 1}. 修正依頼: ${fb}`);
    } else {
      summaryLines.push(`❌ ${index + 1}. 却下`);
    }
  }

  // 判定がなかった記事を処理（返信に番号が含まれていなかった場合はスキップ）
  const reviewedIndexes = new Set(verdicts.map((v) => v.index));
  const unreviewed = posts
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !reviewedIndexes.has(i));

  if (unreviewed.length > 0) {
    summaryLines.push(`\n⏭ 未返信 ${unreviewed.length}件 → スキップ`);
  }

  summaryLines.push(`\n投稿: ${approved.length}件 / 修正: ${feedback.length}件 / 却下・スキップ: ${posts.length - approved.length - feedback.length}件`);
  await sendMessage(summaryLines.join("\n"));

  return { approved, feedback };
}

// ─────────────────────────────────────────────────────────────
// エクスポート
// ─────────────────────────────────────────────────────────────

module.exports = { reviewPosts, sendMessage };
