/**
 * normalizeNews.js
 * RSSパーサのitemを統一形式に変換する
 *
 * 正規化後の形式:
 * {
 *   title:     string
 *   link:      string
 *   source:    string   // フィード名
 *   pubDate:   string   // ISO 8601 or ""
 *   summary:   string
 *   fetchedAt: string   // ISO 8601
 * }
 */

function cleanText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]*>/g, " ")   // HTMLタグ除去
    .replace(/\s+/g, " ")
    .trim();
}

function resolvePubDate(item) {
  const raw = item.isoDate || item.pubDate || "";
  if (!raw) return "";

  const d = new Date(raw);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function normalizeArticle(item, feedName) {
  return {
    title:     cleanText(item.title),
    link:      (item.link || "").trim().replace(/\/$/, ""),
    source:    feedName || "",
    pubDate:   resolvePubDate(item),
    summary:   cleanText(item.contentSnippet || item.content || item["content:encoded"] || ""),
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeArticles(items, feedName) {
  return items
    .map((item) => normalizeArticle(item, feedName))
    .filter((article) => article.title && article.link);
}

module.exports = { normalizeArticle, normalizeArticles };
