/**
 * scoreNews.js
 * キーワードスコアリング・カテゴリ分類・鮮度スコアを付与する
 *
 * 各記事に以下を追加する:
 *   category       : string
 *   categoryHits   : string[]
 *   keywordHits    : string[]
 *   score          : number
 *   freshnessScore : number
 */

// ─────────────────────────────────────────────────────────────
// スコア用キーワード定義
// BIM/AEC関連キーワードを高スコアにして、
// 汎用AIキーワードだけの記事が上位に来ないようにする
// ─────────────────────────────────────────────────────────────

const SCORE_KEYWORDS = [
  // 最優先 BIM固有 (5点)
  { word: "revit",            score: 5 },
  { word: "archicad",         score: 5 },
  { word: "gloobe",           score: 5 },
  { word: "ifc",              score: 5 },
  { word: "openbim",          score: 5 },
  { word: "buildingsmart",    score: 5 },
  { word: "open bim",         score: 5 },

  // 高優先 BIM/AECコア (3点)
  { word: "bim",              score: 3 },
  { word: "aec",              score: 3 },
  { word: "digital twin",     score: 3 },
  { word: "graphisoft",       score: 3 },
  { word: "autodesk",         score: 3 },
  { word: "bimx",             score: 3 },
  { word: "gdl",              score: 3 },
  { word: "dynamo",           score: 3 },
  { word: "construction cloud", score: 3 },
  { word: "福井コンピュータ",   score: 3 },

  // 周辺テーマ / AEC接続しやすいテック (2点)
  { word: "construction tech",  score: 2 },
  { word: "建設dx",             score: 2 },
  { word: "construction dx",    score: 2 },
  { word: "design automation",  score: 2 },
  { word: "interoperability",   score: 2 },
  { word: "plugin",             score: 2 },
  { word: "api",                score: 2 },
  { word: "automation",         score: 2 },
  { word: "generative design",  score: 2 },
  { word: "bim 360",            score: 2 },
  { word: "cim",                score: 2 },

  // 汎用テック (1点) - 単独では上位に来ない
  { word: "ai",               score: 1 },
  { word: "llm",              score: 1 },
  { word: "agent",            score: 1 },
  { word: "copilot",          score: 1 },
  { word: "generative ai",    score: 1 },
  { word: "workflow",         score: 1 },
];

// ─────────────────────────────────────────────────────────────
// カテゴリ定義
// ─────────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS = {
  REVIT:          ["revit", "dynamo", "autodesk revit", "revit api"],
  ARCHICAD:       ["archicad", "graphisoft", "gdl", "bimx"],
  GLOOBE:         ["gloobe", "福井コンピュータ", "fukuisoftware"],
  IFC:            ["ifc", "openbim", "open bim", "buildingsmart", "ifc4", "ifcjs", "bsdd"],
  BIM_AI:         ["bim ai", "bim ml", "bim automation", "ai bim", "bim agent", "bim copilot"],
  BIM_ECOSYSTEM:  ["bim", "aec", "construction cloud", "digital twin", "design automation", "bim 360", "bim collaboration"],
  AI_DX:          ["ai", "llm", "generative ai", "copilot", "agent", "建設dx", "construction dx", "construction tech"],
};

const CATEGORY_ORDER = [
  "REVIT",
  "ARCHICAD",
  "GLOOBE",
  "IFC",
  "BIM_AI",
  "BIM_ECOSYSTEM",
  "AI_DX",
  "OTHER",
];

// ─────────────────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────────────────

/**
 * "bim" と AI関連キーワードが別々に含まれる場合を検出する
 */
function detectBimAi(text) {
  return (
    wordMatch(text, "bim") &&
    (wordMatch(text, "ai") || wordMatch(text, "llm") || text.includes("automation"))
  );
}

function getSearchText(article) {
  return `${article.title} ${article.summary} ${article.source}`.toLowerCase();
}

/**
 * 単語境界マッチ: 短いキーワード（3文字以下）はスペースや文字境界で区切られた場合のみマッチ
 * これにより "ai" が "ArchDaily" や "capitalism" に誤マッチするのを防ぐ
 */
function wordMatch(text, word) {
  // 英数字のみの短いキーワードは単語境界マッチ
  if (/^[a-z0-9 ]+$/.test(word) && word.length <= 4) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(text);
  }
  return text.includes(word);
}

function calcKeywordScore(text) {
  const hits = [];
  let total = 0;

  for (const { word, score } of SCORE_KEYWORDS) {
    if (wordMatch(text, word)) {
      hits.push(word);
      total += score;
    }
  }

  return { score: total, keywordHits: hits };
}

function detectCategory(text) {
  const scores = {};

  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = words.filter((w) => wordMatch(text, w));
    if (hits.length > 0) {
      scores[category] = { count: hits.length, hits };
    }
  }

  // "bim" と AI関連キーワードが別々に含まれる場合も BIM_AI として検出
  if (!scores["BIM_AI"] && detectBimAi(text)) {
    const bimAiHits = ["bim", "ai"].filter((w) => wordMatch(text, w));
    scores["BIM_AI"] = { count: bimAiHits.length, hits: bimAiHits };
  }

  if (Object.keys(scores).length === 0) {
    return { category: "OTHER", categoryHits: [] };
  }

  // スコアが最も高いカテゴリを採用（同点はCATEGORY_ORDER優先）
  let best = null;
  for (const cat of CATEGORY_ORDER) {
    if (scores[cat]) {
      if (!best || scores[cat].count > scores[best].count) {
        best = cat;
      }
    }
  }

  return {
    category:      best || "OTHER",
    categoryHits:  scores[best]?.hits || [],
    allCategories: Object.keys(scores),
  };
}

function calcFreshnessScore(pubDate) {
  if (!pubDate) return 0;

  const pub = new Date(pubDate);
  if (isNaN(pub.getTime())) return 0;

  const diffMs   = Date.now() - pub.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 24)  return 3;
  if (diffHours <= 72)  return 2;
  if (diffHours <= 168) return 1;  // 7日以内
  return 0;
}

// ─────────────────────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────────────────────

function scoreArticle(article) {
  const text = getSearchText(article);

  const { score, keywordHits }     = calcKeywordScore(text);
  const { category, categoryHits, allCategories } = detectCategory(text);
  const freshnessScore             = calcFreshnessScore(article.pubDate);

  return {
    ...article,
    category,
    categoryHits,
    allCategories,
    keywordHits,
    score:          score + freshnessScore,
    freshnessScore,
  };
}

function scoreNews(articles) {
  return articles
    .map(scoreArticle)
    .sort((a, b) => b.score - a.score);
}

module.exports = { scoreNews, scoreArticle };
