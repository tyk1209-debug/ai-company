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
記事を読んで、X（旧Twitter）への投稿文を日本語で作成してください。

【ルール】
- URL・ハッシュタグを除いた本文を140字以内で書く
- 「何が重要か」「なぜ今注目すべきか」「現場への影響」のどれかを必ず入れる
- ニュースのタイトルをそのまま訳しただけの文章は禁止
- 読んだ人が「これは見ておくべき」と思える視点を入れる
- 体言止め・箇条書き禁止。自然な日本語の文章で書く
- 投稿本文のみを返す（前置き・説明・ハッシュタグは不要）`;

async function generateXPostBody(article, articleBody) {
  const client = createClient();
  if (!client) return "";

  const prompt = `記事タイトル: ${article.title}

記事本文:
${articleBody.slice(0, 2500)}

上記を読んで、X投稿文（140字以内）を作成してください。`;

  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: prompt }],
    });

    return response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .slice(0, 140);
  } catch (err) {
    console.error(`[summarize] Claude API エラー: ${err.message}`);
    return "";
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
  const postBody = await generateXPostBody(article, body);
  console.log(`[summarize] 投稿文生成: ${postBody.length > 0 ? "成功" : "空（失敗）"}`);

  return {
    ...article,
    xPostBody:       postBody,
    japaneseSummary: postBody, // 後方互換
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
