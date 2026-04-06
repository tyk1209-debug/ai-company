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

const SYSTEM_PROMPT = `あなたはBIM・AEC・建設DX分野の専門編集者です。
記事を読んで、以下をJSON形式で返してください。

【出力形式】
{
  "relevant": true,
  "titleJa": "日本語の見出し（25〜40文字、読者が思わずクリックしたくなる表現）",
  "bodyJa": "記事の要点を200〜300文字の日本語で解説。背景・内容・業界への影響を含む。",
  "xPost": "X投稿本文（200字以内。絵文字と本文のみ。URLやハッシュタグは含めない）"
}

【relevantの判定ルール】
- BIM・AEC・建設DX・設計ソフト（Revit/Archicad/IFC等）・建設テックに直接関係する場合は true
- 以下のいずれかに該当する場合は false（titleJa/bodyJa/xPostは空文字でよい）:
  - 建築の文化・歴史・芸術・哲学・社会論（ダンス、宇宙観、植民地主義等）
  - 一般的なAI話題でBIM/建設現場との接続が皆無
  - 不動産マーケット・住宅価格・建売情報
  - 建設業界と無関係なイベント・受賞・人物紹介

【titleJaのルール】（relevant: true のときのみ）
- ニュースの核心を一文で表す
- 「〜が変わる」「〜の衝撃」「〜ついに登場」など引きのある表現を使う
- 専門用語はそのまま使ってよい（BIM、IFC、デジタルツイン等）
- 体言止めOK

【bodyJaのルール】（relevant: true のときのみ）
- 導入・内容・影響の3部構成で書く
- 専門用語（BIM、IFC、デジタルツイン等）はそのまま使用
- ですます調で統一する
- 200〜300文字を厳守する

【xPostのルール】（relevant: true のときのみ）
- 冒頭に建設・設計関連の絵文字を必ず1つ入れる（🏗️🔧📐💡🖥️🏢📊🔩⚙️など）
- 「何が重要か」「なぜ今注目すべきか」「現場への影響」のどれかを入れる
- タイトルをそのまま訳した文章は禁止
- 「〜です」「〜ます」の単調な語尾を避け、問いかけや驚きの表現を入れる
- 体言止め・箇条書き禁止。自然な日本語で書く
- URLやハッシュタグは含めない（後でワークフローが付与する）
- 200字以内を厳守する
- JSON以外は返さない`;

async function generateXPostBody(article, articleBody) {
  const client = createClient();
  if (!client) return { xPost: "", titleJa: "", bodyJa: "" };

  const prompt = `記事タイトル: ${article.title}

記事本文:
${articleBody.slice(0, 5000)}

上記を読んで、JSONで返してください。`;

  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { xPost: raw.slice(0, 140), titleJa: "", bodyJa: "" };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      relevant: parsed.relevant !== false, // 明示的にfalseの場合のみ除外
      xPost:   (parsed.xPost   || "").slice(0, 100),
      titleJa: (parsed.titleJa || "").slice(0, 60),
      bodyJa:  (parsed.bodyJa  || "").slice(0, 400),
    };
  } catch (err) {
    console.error(`[summarize] Claude API エラー: ${err.message}`);
    return { relevant: true, xPost: "", titleJa: "", bodyJa: "" };
  }
}

// ─────────────────────────────────────────────────────────────
// カテゴリ別ハッシュタグ定義
// ─────────────────────────────────────────────────────────────

const CATEGORY_HASHTAGS = {
  REVIT:         "#Revit #BIM",
  ARCHICAD:      "#Archicad #BIM",
  BIM_ECOSYSTEM: "#BIM #建設DX",
  BIM_AI:        "#BIM #建設DX",
  IFC:           "#IFC #BIM",
  AI_DX:         "#建設DX #AI",
  GLOOBE:        "#GLOOBE #BIM",
  OTHER:         "#BIM #AEC",
};

/**
 * カテゴリに対応するハッシュタグ文字列を返す
 * @param {string|undefined} category
 * @returns {string}
 */
function getHashtags(category) {
  if (!category) return CATEGORY_HASHTAGS.OTHER;
  const key = category.toUpperCase().replace(/[^A-Z_]/g, "_");
  return CATEGORY_HASHTAGS[key] || CATEGORY_HASHTAGS.OTHER;
}

/**
 * xPost本文にハッシュタグを末尾付与する（140字超えの場合は本文を切り詰める）
 * @param {string} xPost
 * @param {string} hashtags
 * @returns {string}
 */
function appendHashtags(xPost, hashtags) {
  const suffix = " " + hashtags;
  const combined = xPost + suffix;
  if ([...combined].length <= 230) return combined;
  // 超過する場合は本文を切り詰めてハッシュタグを付与
  const maxBodyLen = 230 - [...suffix].length;
  return [...xPost].slice(0, maxBodyLen).join("") + suffix;
}

// ─────────────────────────────────────────────────────────────
// 1件処理
// ─────────────────────────────────────────────────────────────

async function summarizeArticle(article) {
  const client = createClient();
  if (!client) {
    console.log("[summarize] ANTHROPIC_API_KEY 未設定 — スキップ");
    return { ...article, xPostBody: "", japaneseSummary: "", bodyJa: "" };
  }

  console.log(`[summarize] 処理中: ${article.title?.slice(0, 50)}`);
  const body    = await getArticleBody(article);
  console.log(`[summarize] 記事本文取得: ${body.length}文字`);
  const result = await generateXPostBody(article, body);

  // 適切性チェック: relevant=false の場合は除外フラグを立てて早期リターン
  if (result.relevant === false) {
    console.log(`[summarize] ⛔ 不適切と判定 — 除外: ${article.title?.slice(0, 60)}`);
    return { ...article, relevant: false, xPostBody: "", japaneseSummary: "", bodyJa: "", titleJa: "" };
  }

  console.log(`[summarize] 投稿文生成: ${result.xPost.length > 0 ? "成功" : "空（失敗）"}`);
  console.log(`[summarize] 日本語タイトル: ${result.titleJa || "（生成失敗）"}`);
  console.log(`[summarize] 日本語本文: ${result.bodyJa.length > 0 ? `${result.bodyJa.length}文字` : "（生成失敗）"}`);

  const hashtags   = getHashtags(article.category);
  const xPostFinal = result.xPost ? appendHashtags(result.xPost, hashtags) : "";
  console.log(`[summarize] ハッシュタグ付与: ${hashtags} → ${[...xPostFinal].length}字`);

  return {
    ...article,
    relevant:        true,
    titleJa:         result.titleJa,
    bodyJa:          result.bodyJa,
    xPostBody:       xPostFinal,
    japaneseSummary: xPostFinal, // 後方互換
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
    relevant:        true,
    xPostBody:       "",
    japaneseSummary: "",
    bodyJa:          "",
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
