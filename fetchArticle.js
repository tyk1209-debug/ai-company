/**
 * fetchArticle.js
 * 記事URLから本文テキストを取得するモジュール
 *
 * 使い方:
 *   const { fetchArticleText } = require("./fetchArticle.js");
 *   const text = await fetchArticleText("https://...");
 */

const https = require("https");
const http  = require("http");

const FETCH_TIMEOUT_MS = 10000;
const MAX_TEXT_LENGTH  = 6000; // Claudeに渡す最大文字数

// ─────────────────────────────────────────────────────────────
// HTML → プレーンテキスト変換
// ─────────────────────────────────────────────────────────────

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// URLフェッチ（リダイレクト対応）
// ─────────────────────────────────────────────────────────────

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error("Too many redirects"));
    }

    const lib     = url.startsWith("https") ? https : http;
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BIMNewsBot/1.0)",
        "Accept":     "text/html,application/xhtml+xml",
      },
      timeout: FETCH_TIMEOUT_MS,
    };

    const req = lib.get(url, options, (res) => {
      // リダイレクト処理
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetchUrl(next, redirectCount + 1));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.on("error", reject);
  });
}

// ─────────────────────────────────────────────────────────────
// メイン: 記事本文テキストを取得
// ─────────────────────────────────────────────────────────────

/**
 * URLから記事本文テキストを取得する
 * @param {string} url
 * @returns {Promise<string>} 本文テキスト（最大 MAX_TEXT_LENGTH 文字）
 */
async function fetchArticleText(url) {
  try {
    const html = await fetchUrl(url);
    const text = htmlToText(html);
    return text.slice(0, MAX_TEXT_LENGTH);
  } catch (err) {
    return ""; // 取得失敗時は空文字（RSSのsummaryにフォールバック）
  }
}

module.exports = { fetchArticleText };
