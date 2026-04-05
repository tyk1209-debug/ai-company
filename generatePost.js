/**
 * generatePost.js
 * 投稿候補記事からX（Twitter）投稿文を自動生成する
 *
 * 現在: キーワードベースのテンプレート生成（無料・即時動作）
 * 将来: Claude API連携に差し替えやすい設計にしてある
 */

// ─────────────────────────────────────────────────────────────
// カテゴリ別ハッシュタグ定義
// ─────────────────────────────────────────────────────────────

const CATEGORY_HASHTAGS = {
  REVIT:          ["#Revit", "#BIM", "#Autodesk"],
  ARCHICAD:       ["#Archicad", "#Graphisoft", "#BIM"],
  GLOOBE:         ["#GLOOBE", "#BIM", "#建設DX"],
  IFC:            ["#IFC", "#openBIM", "#buildingSMART"],
  BIM_AI:         ["#BIM", "#AI", "#建設DX"],
  BIM_ECOSYSTEM:  ["#BIM", "#AEC", "#建設テック"],
  AI_DX:          ["#AI", "#建設DX", "#DX"],
  OTHER:          ["#建設テック", "#AEC"],
};

// ─────────────────────────────────────────────────────────────
// カテゴリ別リードコピー（書き出しバリエーション）
// ─────────────────────────────────────────────────────────────

const CATEGORY_LEADS = {
  REVIT: [
    "Revitの最新情報👇",
    "Autodesk / Revit アップデート情報",
    "Revitユーザー注目の情報です",
  ],
  ARCHICAD: [
    "Archicadの最新情報👇",
    "Graphisoft / Archicad アップデート情報",
    "Archicadユーザー向け情報です",
  ],
  GLOOBE: [
    "GLOOBEの最新情報👇",
    "国産BIMソフト GLOOBE の情報です",
  ],
  IFC: [
    "openBIM / IFC の最新動向👇",
    "buildingSMART / IFC に関する情報です",
    "IFC・openBIM 標準化の最新情報",
  ],
  BIM_AI: [
    "BIM × AI の最新事例👇",
    "AIがBIMを変える——最新情報です",
    "建設×AI の実務事例が出ています",
  ],
  BIM_ECOSYSTEM: [
    "BIMエコシステムの最新情報👇",
    "AEC業界の注目ニュースです",
    "建設テックの最前線情報",
  ],
  AI_DX: [
    "建設DX / AIの最新動向👇",
    "建設業界のAI活用事例です",
    "DX推進に役立つ情報です",
  ],
  OTHER: [
    "建設テックの注目情報👇",
    "AEC業界の最新ニュースです",
  ],
};

// ─────────────────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────────────────

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function truncate(text, maxLen) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

function formatPubDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `（${m}/${day}）`;
}

// ─────────────────────────────────────────────────────────────
// 投稿文生成
// ─────────────────────────────────────────────────────────────

/**
 * 1件の記事からX投稿文を生成する
 * Claude生成の xPostBody がある場合はそれを本文として使用する
 * @param {object} article - summarize.js 処理済みの記事
 * @returns {string} 投稿文
 */
function generatePost(article) {
  const hashtags = CATEGORY_HASHTAGS[article.category] || CATEGORY_HASHTAGS.OTHER;
  const hashStr  = hashtags.join(" ");

  // Claude生成の本文があればそちらを優先
  if (article.xPostBody) {
    return [
      article.xPostBody,
      "",
      article.link,
      "",
      hashStr,
    ].join("\n");
  }

  // フォールバック: 従来のテンプレート形式
  const leads   = CATEGORY_LEADS[article.category] || CATEGORY_LEADS.OTHER;
  const lead    = pickRandom(leads);
  const dateStr = formatPubDate(article.pubDate);

  const fixedLen = lead.length + dateStr.length + 23 + hashStr.length + 4;
  const titleLen = Math.max(20, 140 - fixedLen);
  const title    = truncate(article.title, titleLen);

  return [
    lead,
    "",
    `${title}${dateStr}`,
    "",
    article.link,
    "",
    hashStr,
  ].join("\n");
}

/**
 * 複数記事の投稿文を一括生成する
 * @param {object[]} articles
 * @returns {object[]} 元の記事に postText を追加した配列
 */
function generatePosts(articles) {
  return articles.map((article) => ({
    ...article,
    postText: generatePost(article),
  }));
}

module.exports = { generatePost, generatePosts };
