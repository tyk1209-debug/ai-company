/**
 * dedupeNews.js
 * URL重複・タイトル重複を除去する
 */

function normalizeUrl(url) {
  return (url || "").trim().replace(/\/$/, "").toLowerCase();
}

function normalizeTitle(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")  // 記号除去（Unicode対応）
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeByUrl(articles) {
  const seen = new Set();
  const result = [];

  for (const article of articles) {
    const key = normalizeUrl(article.link);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result;
}

function dedupeByTitle(articles) {
  const seen = new Set();
  const result = [];

  for (const article of articles) {
    const key = normalizeTitle(article.title);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result;
}

function dedupeNews(articles) {
  const afterUrl   = dedupeByUrl(articles);
  const afterTitle = dedupeByTitle(afterUrl);
  return afterTitle;
}

module.exports = { dedupeNews, dedupeByUrl, dedupeByTitle };
