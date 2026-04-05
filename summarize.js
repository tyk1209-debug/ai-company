/**
 * summarize.js
 * Claude APIを使って記事本文を取得・読解し、専門家視点のX投稿文を生成する
 *
 * 各記事に以下を追加する:
 *   xPostBody : string  （X投稿本文。URL・ハッシュタグを除いた140字以内）
 *   japaneseSummary : string  （後方互換用。xPostBodyと同じ値）
 */

const Anthropic = require("@anthropic-ai/sdk");
const { fetchArticleText } = require("./fetchArticle.js");

// ─────────────────────────────────────────────────────────────
// Claude APIクライアント
// ─────────────────────────────────────────────────────────────

function createClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// 記事本文を取得（URLフェッチ → フォールバック: RSSのsummary）
// ─────────────────────────────────────────────────────────────

async function getArticleBody(article) {
  // まずURLから全文取得を試みる
  if (article.link) {
    const fetched = await fetchArticleText(article.link);
    if (fetched && fetched.length > 200) {
      return fetched;
    }
  }
  // フォールバック: RSSのsummaryフィールド
  return (article.summary || "").slice(0, 1500);
}

// ─────────────────────────────────────────────────────────────
// 専門家コメント付きX投稿文を生成
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたはBIM・AEC・建設DX分野の専門家です。
記事を読んで、以下をJSON形式で返してください。

【出力形式】
{
  "titleJa": "日本語の見出し（25〜40文字、読者が思わずクリックしたくなる表現）",
  "xPost": "X投稿本文（140字以内）"
}

【titleJaのルール】
- ニュースの核心を一文で表す
- 「〜が変わる」「〜の衝撃」「〜ついに登場」など引きのある表現を使う
- 専門用語はそのまま使ってよい（BIM、IFC、デジタルツイン等）
- 体言止めOK

【xPostのルール】
- 「何が重要か」「なぜ今注目すべきか」「現場への影響」のどれかを入れる
- タイトルをそのまま訳した文章は禁止
- 体言止め・箇条書き禁止。自然な日本語で書く
- JSON以外は返さない`;

async function generateXPostBody(article, articleBody) {
  const client = createClient();
  if (!client) return { xPost: "", titleJa: "" };

  const prompt = `記事タイトル: ${article.title}

記事本文:
${articleBody.slice(0, 2500)}

上記を読んで、JSONで返してください。`;

  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { xPost: raw.slice(0, 140), titleJa: "" };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      xPost:   (parsed.xPost   || "").slice(0, 140),
      titleJa: (parsed.titleJa || "").slice(0, 60),
    };
  } catch (err) {
    console.error(`[summarize] Claude API エラー: ${err.message}`);
    return { xPost: "", titleJa: "" };
  }
}

// ─────────────────────────────────────────────────────────────
// 1件処理
// ─────────────────────────────────────────────────────────────

async function summarizeArticle(article) {
  const client = createClient();
  if (!client) {
    console.log("[summarize] ANTHROPIC_API_KEY 未設定 — スキップ");
    return { ...article, xPostBody: "", japaneseSummary: "" };
  }

  console.log(`[summarize] 処理中: ${article.title?.slice(0, 50)}`);
  const body    = await getArticleBody(article);
  console.log(`[summarize] 記事本文取得: ${body.length}文字`);
  const result = await generateXPostBody(article, body);
  console.log(`[summarize] 投稿文生成: ${result.xPost.length > 0 ? "成功" : "空（失敗）"}`);
  console.log(`[summarize] 日本語タイトル: ${result.titleJa || "（生成失敗）"}`);

  return {
    ...article,
    titleJa:         result.titleJa,
    xPostBody:       result.xPost,
    japaneseSummary: result.xPost, // 後方互換
  };
}

// ─────────────────────────────────────────────────────────────
// 複数件処理
// ─────────────────────────────────────────────────────────────

async function summarizeArticles(articles, options = {}) {
  const limit  = options.limit ?? 5;
  const target = articles.slice(0, limit);
  const rest   = articles.slice(limit);

  const results = [];
  for (let i = 0; i < target.length; i++) {
    results.push(await summarizeArticle(target[i]));
    if (i < target.length - 1) await sleep(300);
  }

  const restWithEmpty = rest.map((a) => ({
    ...a,
    xPostBody:       "",
    japaneseSummary: "",
  }));

  return [...results, ...restWithEmpty];
}

// ─────────────────────────────────────────────────────────────
// フィードバック付き再生成
// ─────────────────────────────────────────────────────────────

async function summarizeWithFeedback(article, feedbackText) {
  const client = createClient();
  if (!client) return article;

  const body = await getArticleBody(article);

  const prompt = `記事タイトル: ${article.title}

記事本文:
${body.slice(0, 2500)}

現在の投稿文:
${article.xPostBody || article.japaneseSummary || "（なし）"}

【修正依頼】: ${feedbackText}

修正した投稿文（140字以内）を作成してください。`;

  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .slice(0, 140);

    return {
      ...article,
      xPostBody:       text,
      japaneseSummary: text,
      fixedByFeedback: true,
    };
  } catch {
    return article;
  }
}

module.exports = {
  summarizeArticle,
  summarizeArticles,
  summarizeWithFeedback,
};
