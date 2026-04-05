/**
 * scraper.js
 * RSSフィードが存在しない日本語ソースのスクレイピング
 *
 * 対象:
 *   - 国土交通省 建築BIM推進会議 (mlit.go.jp)
 *
 * exportする関数:
 *   scrapeJapaneseSources() → 記事配列 (news.js の記事フォーマットと互換)
 */

const https = require("https");

// ─────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────

/**
 * 指定URLのHTMLをフェッチして文字列で返す（リダイレクト追跡、User-Agent付き）
 * @param {string} url
 * @param {number} [redirectsLeft=5]
 * @returns {Promise<string>}
 */
function fetchHtml(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AECNewsBot/1.0; +https://github.com/ai-company)",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "ja,en;q=0.5",
      },
      timeout: 15000,
    };

    const req = https.get(url, options, (res) => {
      // リダイレクト処理
      if (
        (res.statusCode === 301 ||
          res.statusCode === 302 ||
          res.statusCode === 307 ||
          res.statusCode === 308) &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        const nextUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        resolve(fetchHtml(nextUrl, redirectsLeft - 1));
        return;
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve(buf.toString("utf8"));
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out: ${url}`));
    });
  });
}

/**
 * 和暦 (R8.4.2 形式) を ISO 8601 文字列に変換する
 * 令和元年 = 2019年
 * @param {string} wareki  例: "R8.4.2" | "R7.12.24"
 * @returns {string}
 */
function warekiToIso(wareki) {
  const m = wareki.match(/R(\d+)\.(\d+)\.(\d+)/);
  if (!m) return new Date().toISOString();
  const year  = 2018 + parseInt(m[1], 10);
  const month = m[2].padStart(2, "0");
  const day   = m[3].padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

// ─────────────────────────────────────────────────────────────
// 国土交通省 建築BIM推進会議
// ─────────────────────────────────────────────────────────────

const MLIT_URL =
  "https://www.mlit.go.jp/jutakukentiku/kenchikuBIMsuishinkaigi.html";
const MLIT_BASE = "https://www.mlit.go.jp";

/**
 * mlit.go.jp の建築BIM推進会議ページから更新情報を取得する。
 * ページ内のテーブル行 <tr> から日付・本文・リンクを抽出する。
 * @returns {Promise<Array>}
 */
async function scrapeMlit() {
  const articles = [];

  try {
    const html = await fetchHtml(MLIT_URL);

    // テーブル行を全て抽出（改行を含む複数行マッチ）
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rowMatches = [];
    let m;
    while ((m = rowPattern.exec(html)) !== null) {
      rowMatches.push(m[0]);
    }

    for (const row of rowMatches) {
      // 和暦日付パターンを探す (R8.4.2, R7.12.24 など)
      const dateMatch = row.match(/R(\d+\.\d+\.\d+)/);
      if (!dateMatch) continue;

      const warekiStr = `R${dateMatch[1]}`;
      const pubDate   = warekiToIso(warekiStr);

      // テキストを取得 (タグを除去)
      const rawText = row
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&#8211;/g, "–")
        .replace(/\s+/g, " ")
        .trim();

      // 日付部分を除いたタイトル相当テキスト
      const title = rawText
        .replace(/R\d+\.\d+\.\d+/, "")
        .trim()
        .replace(/^[\s\u3000]+/, "");

      if (!title || title.length < 5) continue;

      // リンク取得
      const linkMatch = row.match(/href=["']([^"']+)["']/i);
      let link = linkMatch ? linkMatch[1] : MLIT_URL;
      if (link.startsWith("/")) {
        link = MLIT_BASE + link;
      }

      articles.push({
        title:    `[国交省BIM] ${title}`,
        link,
        pubDate,
        summary:  title,
        source:   "国土交通省 建築BIM推進会議",
        category: "BIM_ECOSYSTEM",
      });
    }
  } catch (err) {
    console.error(`[scraper] mlit.go.jp 取得エラー: ${err.message}`);
  }

  return articles;
}

// ─────────────────────────────────────────────────────────────
// メインエクスポート
// ─────────────────────────────────────────────────────────────

/**
 * 全スクレイピング対象から記事を収集して返す
 * @returns {Promise<Array>}
 */
async function scrapeJapaneseSources() {
  const results = await Promise.all([
    scrapeMlit(),
  ]);

  return results.flat();
}

module.exports = { scrapeJapaneseSources };
