'use strict';

/**
 * weeklyDigest.js
 * 過去7日間のBIM/AECニュースをまとめた週次記事をClaude Haiku APIで生成し、
 * posts/weekly-{YYYY-MM-DD}.html に保存する。
 * 生成後は generateSite.js を再実行してサイトを更新する。
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---- Claude client ----------------------------------------------------------

function createClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// ---- date helpers -----------------------------------------------------------

function toISODate(d) {
  return d.toISOString().split('T')[0];
}

function formatDateJa(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
}

function getWeekRange() {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return { start, end, endIso: toISODate(end) };
}

// ---- load recent articles from data/ ----------------------------------------

function loadRecentArticles() {
  const dataDir = path.join(__dirname, 'data');
  const candidates = ['posts.json', 'summarized_news.json', 'scored_news.json'];

  for (const filename of candidates) {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(raw) && raw.length > 0) {
        console.log(`[weeklyDigest] Loaded ${raw.length} articles from ${filename}`);
        return raw;
      }
    } catch (err) {
      console.warn(`[weeklyDigest] Failed to parse ${filename}: ${err.message}`);
    }
  }
  return [];
}

function filterLastSevenDays(articles) {
  const { start } = getWeekRange();
  const filtered = articles.filter((a) => {
    if (!a.pubDate) return false;
    const d = new Date(a.pubDate);
    return !isNaN(d.getTime()) && d >= start;
  });
  console.log(`[weeklyDigest] Articles in past 7 days: ${filtered.length}`);
  return filtered;
}

// ---- build summary prompt ---------------------------------------------------

function buildDigestPrompt(articles, startDate, endDate) {
  const articleList = articles
    .slice(0, 20) // APIコスト節約のため最大20件
    .map((a, i) => {
      const title = a.titleJa || a.title || '（タイトル不明）';
      const body = (a.bodyJa || a.summary || '').slice(0, 300);
      const source = a.source || '';
      return `${i + 1}. 【${title}】${source ? `（${source}）` : ''}\n${body}`;
    })
    .join('\n\n');

  const startJa = formatDateJa(startDate.toISOString());
  const endJa = formatDateJa(endDate.toISOString());

  return `以下は${startJa}〜${endJa}のBIM・AECニュース記事一覧です。
これらを読んで、週次まとめ記事を日本語で作成してください。

【出力形式】JSON のみ。説明文不要。
{
  "titleJa": "今週のBIM・AEC注目ニュース（${startJa}〜${endJa}）",
  "bodyJa": "週次まとめ本文（400〜600文字）"
}

【bodyJaのルール】
- 今週の主要トピックを3〜5点に絞って解説する
- 「〜しました」「〜が発表されました」など報告調で統一する
- 各トピックの業界への影響・意義を簡潔に添える
- 400〜600文字を厳守する
- JSON以外は返さない

【記事一覧】
${articleList}`;
}

// ---- call Claude API --------------------------------------------------------

async function generateDigestContent(articles, startDate, endDate) {
  const client = createClient();
  if (!client) {
    console.warn('[weeklyDigest] ANTHROPIC_API_KEY が未設定のため、ダミーコンテンツを使用します');
    const startJa = formatDateJa(startDate.toISOString());
    const endJa = formatDateJa(endDate.toISOString());
    return {
      titleJa: `今週のBIM・AEC注目ニュース（${startJa}〜${endJa}）`,
      bodyJa: `今週は${articles.length}件のBIM・AECニュースがありました。（ANTHROPIC_API_KEY が未設定のためまとめを生成できませんでした）`,
    };
  }

  const prompt = buildDigestPrompt(articles, startDate, endDate);

  try {
    console.log('[weeklyDigest] Claude Haiku API を呼び出し中...');
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: 'あなたはBIM・AEC・建設DX分野の専門編集者です。週次ニュースまとめをJSON形式で返してください。',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('APIレスポンスからJSONを抽出できませんでした');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      titleJa: (parsed.titleJa || '').slice(0, 100),
      bodyJa: (parsed.bodyJa || '').slice(0, 800),
    };
  } catch (err) {
    console.error(`[weeklyDigest] Claude API エラー: ${err.message}`);
    const startJa = formatDateJa(startDate.toISOString());
    const endJa = formatDateJa(endDate.toISOString());
    return {
      titleJa: `今週のBIM・AEC注目ニュース（${startJa}〜${endJa}）`,
      bodyJa: `今週のBIM・AECニュースまとめの生成に失敗しました。（エラー: ${err.message}）`,
    };
  }
}

// ---- build post record -------------------------------------------------------

function buildPostRecord(titleJa, bodyJa, endIso) {
  return {
    title: titleJa,
    titleJa,
    bodyJa,
    category: 'BIM_ECOSYSTEM',
    pubDate: new Date(endIso).toISOString(),
    slug: `weekly-${endIso}`,
    source: 'AEC News Japan 週次まとめ',
    isWeekly: true,
  };
}

// ---- generate HTML page for the weekly digest --------------------------------

function escape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWeeklyHtml(post, allPosts) {
  // Reuse generateSite.js for full rendering by injecting the post into posts.json
  // then running generateSite.js. We just write the record here; site gen happens later.
  // But we also produce a standalone HTML for immediate use.
  const SITE_URL = 'https://aec-news.com';
  const SITE_NAME = 'AEC News Japan';
  const pubDateFormatted = new Date(post.pubDate).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(post.titleJa)} | ${escape(SITE_NAME)}</title>
  <meta name="description" content="${escape(post.bodyJa.slice(0, 120))}">
  <link rel="canonical" href="${SITE_URL}/posts/${escape(post.slug)}.html">
  <meta property="og:title" content="${escape(post.titleJa)}">
  <meta property="og:description" content="${escape(post.bodyJa.slice(0, 120))}">
  <meta property="og:url" content="${SITE_URL}/posts/${escape(post.slug)}.html">
  <meta property="og:type" content="article">
  <meta property="og:image" content="${SITE_URL}/assets/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" href="../assets/favicon.png">
  <meta name="robots" content="index, follow">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #0f2a5e; --blue: #1a56db; --bg: #f5f7fa; --white: #fff;
      --text: #1a1a2e; --text-muted: #6b7280; --border: #e5e7eb;
      --card-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    body { font-family: 'Hiragino Kaku Gothic Pro', 'Meiryo', sans-serif; background: var(--bg); color: var(--text); line-height: 1.75; }
    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .site-header { background: var(--navy); padding: 0.75rem 1.5rem; }
    .header-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; gap: 1rem; }
    .site-title a { color: #fff; font-size: 1.2rem; font-weight: 700; }
    .container { max-width: 1100px; margin: 0 auto; padding: 2rem 1rem; }
    .article-wrap { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 2rem 2.5rem; box-shadow: var(--card-shadow); }
    .weekly-badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 4px; margin-bottom: 1rem; }
    h1 { font-size: 1.6rem; font-weight: 800; color: var(--navy); line-height: 1.4; margin-bottom: 1rem; }
    .article-meta { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem; }
    .article-body { font-size: 0.95rem; line-height: 1.85; white-space: pre-wrap; }
    .back-link { display: inline-block; margin-top: 2rem; font-size: 0.875rem; }
    .site-footer { background: #0f1a33; color: rgba(255,255,255,0.7); padding: 2rem 1.5rem; text-align: center; font-size: 0.8rem; margin-top: 3rem; }
    .footer-nav a { color: rgba(255,255,255,0.6); margin: 0 0.5rem; }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <div class="site-title"><a href="../">${escape(SITE_NAME)}</a></div>
    </div>
  </header>
  <main class="container">
    <div class="article-wrap">
      <span class="weekly-badge">週次まとめ</span>
      <h1>${escape(post.titleJa)}</h1>
      <div class="article-meta">
        <span>${escape(post.source)}</span> &middot; <span>${escape(pubDateFormatted)}</span>
      </div>
      <div class="article-body">${escape(post.bodyJa)}</div>
      <a class="back-link" href="../">&larr; トップに戻る</a>
    </div>
  </main>
  <footer class="site-footer">
    <nav class="footer-nav">
      <a href="../">ホーム</a>
      <a href="../about.html">このサイトについて</a>
      <a href="../privacy.html">プライバシーポリシー</a>
    </nav>
    <p>&copy; ${new Date().getFullYear()} ${escape(SITE_NAME)}</p>
  </footer>
</body>
</html>`;
}

// ---- inject post into posts.json --------------------------------------------

function injectIntoPostsJson(post) {
  const postsFile = path.join(__dirname, 'data', 'posts.json');
  let posts = [];
  if (fs.existsSync(postsFile)) {
    try {
      posts = JSON.parse(fs.readFileSync(postsFile, 'utf-8'));
      if (!Array.isArray(posts)) posts = [];
    } catch {
      posts = [];
    }
  }

  // Remove existing weekly digest for the same week to avoid duplicates
  posts = posts.filter((p) => p.slug !== post.slug);

  // Prepend the new weekly digest
  posts.unshift(post);

  fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2), 'utf-8');
  console.log(`[weeklyDigest] posts.json に週次まとめを追加しました (slug: ${post.slug})`);
}

// ---- main -------------------------------------------------------------------

async function main() {
  console.log('[weeklyDigest] 週次まとめ生成を開始します...');

  const { start, end, endIso } = getWeekRange();
  console.log(`[weeklyDigest] 対象期間: ${toISODate(start)} 〜 ${endIso}`);

  // 1. 過去7日間の記事を取得
  const allArticles = loadRecentArticles();
  const recentArticles = filterLastSevenDays(allArticles);

  if (recentArticles.length === 0) {
    console.warn('[weeklyDigest] 過去7日間の記事が見つかりませんでした。全記事の最新10件を使用します。');
    const fallback = allArticles.slice(0, 10);
    if (fallback.length === 0) {
      console.error('[weeklyDigest] 記事が1件もありません。終了します。');
      process.exit(0);
    }
    recentArticles.push(...fallback);
  }

  // 2. Claude Haiku で週次まとめを生成
  const { titleJa, bodyJa } = await generateDigestContent(recentArticles, start, end);
  console.log(`[weeklyDigest] タイトル: ${titleJa}`);
  console.log(`[weeklyDigest] 本文: ${bodyJa.length}文字`);

  // 3. 記事レコードを構築
  const post = buildPostRecord(titleJa, bodyJa, endIso);

  // 4. posts/weekly-{YYYY-MM-DD}.html を保存（スタンドアロンHTML）
  const postsDir = path.join(__dirname, 'posts');
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }
  const htmlPath = path.join(postsDir, `${post.slug}.html`);
  fs.writeFileSync(htmlPath, buildWeeklyHtml(post), 'utf-8');
  console.log(`[weeklyDigest] HTML保存: ${htmlPath}`);

  // 5. data/posts.json に追加
  injectIntoPostsJson(post);

  // 6. generateSite.js を再実行してサイト全体を更新
  console.log('[weeklyDigest] generateSite.js を実行してサイトを更新します...');
  try {
    execSync('node generateSite.js', { cwd: __dirname, stdio: 'inherit' });
    console.log('[weeklyDigest] サイト更新完了');
  } catch (err) {
    console.error(`[weeklyDigest] generateSite.js の実行に失敗しました: ${err.message}`);
  }

  console.log('[weeklyDigest] 完了');
}

main().catch((err) => {
  console.error('[weeklyDigest] 予期しないエラー:', err.message);
  process.exit(1);
});
