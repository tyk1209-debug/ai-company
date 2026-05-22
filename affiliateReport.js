'use strict';
/**
 * affiliateReport.js
 * GA4 Data API でアフィリエイトクリック数を取得する
 *
 * 必要な環境変数:
 *   GA4_PROPERTY_ID          : GA4プロパティID（数字のみ、例: 123456789）
 *   GA4_SERVICE_ACCOUNT_JSON : サービスアカウントのJSONキー（文字列）
 *
 * 実行: node affiliateReport.js
 */

const https = require('https');

const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const SERVICE_ACCOUNT_JSON = process.env.GA4_SERVICE_ACCOUNT_JSON;

// サービスアカウントなしの場合はスキップ
if (!PROPERTY_ID || !SERVICE_ACCOUNT_JSON) {
  if (require.main === module) {
    console.log('[affiliateReport] GA4_PROPERTY_ID / GA4_SERVICE_ACCOUNT_JSON 未設定 → スキップ');
  }
  module.exports = { fetchAffiliateClicks: async () => null };
  return;
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
} catch (e) {
  console.error('[affiliateReport] GA4_SERVICE_ACCOUNT_JSON のパースに失敗:', e.message);
  module.exports = { fetchAffiliateClicks: async () => null };
  return;
}

// ── JWT / OAuth2 ─────────────────────────────────────────────
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken() {
  const crypto = require('crypto');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = base64url(sign.sign(serviceAccount.private_key));
  const jwt = `${header}.${payload}.${sig}`;

  return new Promise((resolve, reject) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data).access_token); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── GA4 Data API ─────────────────────────────────────────────
async function fetchAffiliateClicks(daysAgo = 1) {
  const token = await getAccessToken();
  const startDate = daysAgo === 1 ? 'yesterday' : `${daysAgo}daysAgo`;

  const requestBody = JSON.stringify({
    dateRanges: [{ startDate, endDate: 'yesterday' }],
    dimensions: [
      { name: 'customEvent:item_id' },
      { name: 'customEvent:item_name' },
      { name: 'customEvent:page_type' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'EXACT', value: 'affiliate_click' },
      },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 20,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'analyticsdata.googleapis.com',
      path: `/v1beta/properties/${PROPERTY_ID}:runReport`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const rows = (json.rows || []).map(row => ({
            itemId: row.dimensionValues[0]?.value || '',
            itemName: row.dimensionValues[1]?.value || '',
            pageType: row.dimensionValues[2]?.value || '',
            clicks: parseInt(row.metricValues[0]?.value || '0', 10),
          }));
          const total = rows.reduce((sum, r) => sum + r.clicks, 0);
          resolve({ total, rows, period: startDate });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// ── Telegram メッセージ生成 ───────────────────────────────────
function formatAffiliateMessage(data) {
  if (!data || data.total === 0) return '🔗 アフィリエイト: クリックなし';
  const top = data.rows.slice(0, 3).map((r, i) =>
    `  ${i + 1}. ${r.itemName.slice(0, 20)} — ${r.clicks}クリック`
  ).join('\n');
  return `🔗 アフィリエイトクリック（昨日）: ${data.total}件\n${top}`;
}

// ── 単体実行 ─────────────────────────────────────────────────
if (require.main === module) {
  fetchAffiliateClicks(1).then(data => {
    console.log(formatAffiliateMessage(data));
    if (data) console.log('\n詳細:', JSON.stringify(data.rows, null, 2));
  }).catch(e => {
    console.error('[affiliateReport] エラー:', e.message);
  });
}

module.exports = { fetchAffiliateClicks, formatAffiliateMessage };
