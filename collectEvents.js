'use strict';

/**
 * collectEvents.js
 * 日本開催のBIM/AECイベントを収集し data/events.json に保存する
 *
 * 収集元:
 *   1. buildingSMART RSS   (RSS取得 → Japan/Tokyo フィルタ)
 *   2. Graphisoft JP       (HTMLスクレイピング)
 *
 * 出力: data/events.json
 *   [{ id, title, date, dateEnd, location, url, source, description, postedToX }]
 */

try { require('dotenv').config(); } catch (e) {}

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');

// ─────────────────────────────────────────────────────────────
// HTTP ユーティリティ
// ─────────────────────────────────────────────────────────────

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'AEC-News-Japan-Bot/1.0 (+https://aec-news.com)',
        'Accept': 'text/html,application/xhtml+xml,application/rss+xml,*/*',
        ...options.headers,
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, options).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ─────────────────────────────────────────────────────────────
// 1. buildingSMART RSS → Japan/Tokyo フィルタ
// ─────────────────────────────────────────────────────────────

async function fetchBuildingSmartEvents() {
  console.log('[collectEvents] buildingSMART RSS を取得中...');
  const xml = await fetchUrl('https://www.buildingsmart.org/events/feed/');

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title       = decodeEntities(extractTag(block, 'title'));
    const link        = decodeEntities(extractTag(block, 'link'));
    const description = stripHtml(decodeEntities(extractTag(block, 'description')))
      .replace(/The post .+? appeared first on .+?\s*\.?\s*$/, '').trim();
    const pubDate     = extractTag(block, 'pubDate');

    // Japan/Tokyo 関連のみ
    const text = (title + description).toLowerCase();
    if (!text.includes('japan') && !text.includes('tokyo') && !text.includes('東京') && !text.includes('日本')) {
      continue;
    }

    // 日付をISO形式に
    const dateObj = pubDate ? new Date(pubDate) : null;
    const dateStr = dateObj && !isNaN(dateObj) ? dateObj.toISOString() : null;

    // URLからslug生成
    const urlSlug = link.split('/').filter(Boolean).pop();
    items.push({
      id: `bsi-${urlSlug}`,
      title,
      date: dateStr,
      dateEnd: null,
      location: extractLocation(title + ' ' + description),
      url: link,
      source: 'buildingSMART International',
      description: description.slice(0, 300),
      postedToX: false,
    });
  }

  console.log(`[collectEvents] buildingSMART: ${items.length}件（日本関連）`);
  return items;
}

// ─────────────────────────────────────────────────────────────
// 2. Graphisoft Japan イベントページ スクレイピング
// ─────────────────────────────────────────────────────────────

async function fetchGraphisoftEvents() {
  console.log('[collectEvents] Graphisoft JP イベントページを取得中...');
  let html;
  try {
    html = await fetchUrl('https://www.graphisoft.com/jp/open-events');
  } catch (err) {
    console.warn(`[collectEvents] Graphisoft JP 取得失敗: ${err.message}`);
    return [];
  }

  const items = [];

  // swiper-slide 内の <a href> リンクと画像altからイベント情報を抽出
  const slideRegex = /<div[^>]*class="[^"]*swiper-slide[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*swiper-slide|<\/div>)/g;
  // シンプルに <a href> を全部取り出してタイトル・URLを取得
  const linkRegex = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let lm;
  const seen = new Set();

  while ((lm = linkRegex.exec(html)) !== null) {
    const href  = lm[1];
    const inner = lm[2];

    // Graphisoft JPのイベント/セミナーURLのみ対象
    if (!href.includes('graphisoft.com') && !href.startsWith('/')) continue;
    if (!href.includes('event') && !href.includes('seminar') && !href.includes('webinar') && !href.includes('training')) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const title = stripHtml(inner).trim().replace(/\s+/g, ' ');
    if (!title || title.length < 5) continue;

    const fullUrl = href.startsWith('http') ? href : `https://www.graphisoft.com${href}`;
    const urlSlug = href.split('/').filter(Boolean).pop();

    items.push({
      id: `gs-${urlSlug}`,
      title,
      date: null,  // 詳細ページに日時が記載されているが動的ロードのため取得困難
      dateEnd: null,
      location: '日本',
      url: fullUrl,
      source: 'Graphisoft Japan',
      description: '',
      postedToX: false,
    });
  }

  // イベントページからテキストブロック（日時情報）を抽出試行
  const datePatterns = [
    /(\d{4}年\d{1,2}月\d{1,2}日)/g,
    /(\d{4}\/\d{1,2}\/\d{1,2})/g,
    /(\d{4}-\d{2}-\d{2})/g,
  ];

  console.log(`[collectEvents] Graphisoft JP: ${items.length}件`);
  return items;
}

// ─────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? (m[1] || m[2] || '') : '';
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractLocation(text) {
  if (/tokyo|東京/i.test(text)) return '東京';
  if (/osaka|大阪/i.test(text)) return '大阪';
  if (/nagoya|名古屋/i.test(text)) return '名古屋';
  if (/online|オンライン|webinar|ウェビナー/i.test(text)) return 'オンライン';
  if (/japan|日本/i.test(text)) return '日本';
  return '日本';
}

// ─────────────────────────────────────────────────────────────
// 既存データとのマージ（postedToX フラグを保持）
// ─────────────────────────────────────────────────────────────

function mergeEvents(existing, fresh) {
  const map = new Map(existing.map((e) => [e.id, e]));
  for (const ev of fresh) {
    if (map.has(ev.id)) {
      // postedToX などのフラグを保持しつつ最新情報で上書き
      map.set(ev.id, { ...ev, postedToX: map.get(ev.id).postedToX });
    } else {
      map.set(ev.id, ev);
    }
  }
  return [...map.values()];
}

// ─────────────────────────────────────────────────────────────
// 過去イベントの除外（開催日が2週間以上前のものを削除）
// ─────────────────────────────────────────────────────────────

function filterStale(events) {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return events.filter((ev) => {
    if (!ev.date) return true; // 日付不明は保持
    const d = new Date(ev.date).getTime();
    return isNaN(d) || d >= cutoff;
  });
}

// ─────────────────────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('[collectEvents] イベント収集を開始します');

  const [bsiEvents, gsEvents] = await Promise.allSettled([
    fetchBuildingSmartEvents(),
    fetchGraphisoftEvents(),
  ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : [])));

  const fresh = [...bsiEvents, ...gsEvents];
  console.log(`[collectEvents] 新規取得: ${fresh.length}件`);

  // 既存データをロード
  let existing = [];
  if (fs.existsSync(EVENTS_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8')); } catch { existing = []; }
  }

  const merged  = mergeEvents(existing, fresh);
  const current = filterStale(merged);

  // 日付順ソート
  current.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : Infinity;
    const db = b.date ? new Date(b.date).getTime() : Infinity;
    return da - db;
  });

  const dir = path.dirname(EVENTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  console.log(`[collectEvents] data/events.json に ${current.length}件 保存`);
}

main().catch((err) => {
  console.error('[collectEvents] エラー:', err.message);
  process.exit(1);
});

module.exports = { main };
