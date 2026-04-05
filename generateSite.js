'use strict';

const fs = require('fs');
const path = require('path');

const SITE_NAME = 'AEC News Japan';
const SITE_DESC = 'BIM・AEC・建設DXの最新ニュースをAIが日本語で解説';
const SITE_URL = 'https://aec-news.com';
const CURRENT_YEAR = new Date().getFullYear();

// ---- utility ----------------------------------------------------------------

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function excerpt(text, maxLen) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen) + '…';
}

function categoryLabel(cat) {
  const map = {
    BIM_ECOSYSTEM: 'BIMエコシステム',
    REVIT: 'Revit',
    IFC: 'IFC',
    DIGITAL_TWIN: 'デジタルツイン',
    CONSTRUCTION_TECH: '建設テック',
    AI: 'AI',
    GIS: 'GIS',
    SUSTAINABILITY: 'サステナビリティ',
  };
  return map[cat] || cat || '一般';
}

function escape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- shared HTML parts ------------------------------------------------------

function htmlHead(title, desc, canonical, base = '.', jsonLd = null) {
  const jsonLdScript = jsonLd
    ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(desc)}">
  <link rel="canonical" href="${escape(canonical)}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(desc)}">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${SITE_URL}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${SITE_URL}/assets/og-image.png">
  <link rel="icon" type="image/png" href="${base}/assets/favicon.png">
  <meta name="robots" content="index, follow">${jsonLdScript}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --navy: #1a2744;
      --navy-light: #243460;
      --blue: #2563eb;
      --blue-light: #3b82f6;
      --text: #1e2939;
      --text-muted: #5a6a7e;
      --border: #dde3ec;
      --bg: #f5f7fa;
      --white: #ffffff;
      --card-shadow: 0 1px 4px rgba(26,39,68,0.08);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue',
                   Arial, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: var(--text);
      background: var(--bg);
    }

    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ---- header ---- */
    .site-header {
      background: var(--navy);
      color: var(--white);
      padding: 0 1.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .header-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 0;
    }
    .logo-wrapper {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .logo-icon {
      width: 8px;
      height: 8px;
      background: #2563eb;
      flex-shrink: 0;
    }
    .site-title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .site-title a { color: var(--white); }
    .site-tagline {
      font-size: 0.75rem;
      opacity: 0.7;
      margin-top: 0.15rem;
    }
    nav {
      display: flex;
      align-items: center;
      flex-wrap: nowrap;
      white-space: nowrap;
    }
    nav a {
      color: rgba(255,255,255,0.85);
      font-size: 0.875rem;
      margin-left: 1.25rem;
    }
    nav a:hover { color: var(--white); text-decoration: none; }

    /* ---- hero ---- */
    .hero {
      background:
        linear-gradient(135deg, rgba(26,39,68,0.88) 0%, rgba(36,52,96,0.82) 60%, rgba(30,58,110,0.80) 100%),
        url('./assets/hero-bg.jpg') center/cover no-repeat;
      color: var(--white);
      padding: 3rem 1.5rem;
      text-align: left;
      position: relative;
      overflow: hidden;
      min-height: 320px;
      display: flex;
      align-items: center;
    }
    .hero::after {
      content: '';
      position: absolute;
      right: 60px;
      top: 50%;
      transform: translateY(-50%);
      width: 260px;
      height: 220px;
      border: 2px solid rgba(59,130,246,0.45);
      border-radius: 4px;
      box-shadow:
        inset 0 0 0 18px rgba(37,99,235,0.08),
        22px -22px 0 0 rgba(59,130,246,0.30),
        44px -44px 0 0 rgba(59,130,246,0.18);
      pointer-events: none;
    }
    .hero-content {
      position: relative;
      z-index: 1;
      max-width: 600px;
    }
    .hero h1 {
      font-size: clamp(1.4rem, 3vw, 2.2rem);
      font-weight: 700;
      margin-bottom: 0.75rem;
      word-break: keep-all;
      overflow-wrap: normal;
      white-space: nowrap;
    }
    .hero-badge {
      display: inline-block;
      background: rgba(37,99,235,0.3);
      border: 1px solid rgba(37,99,235,0.5);
      border-radius: 20px;
      padding: 0.3rem 0.9rem;
      font-size: 0.875rem;
      opacity: 0.95;
      margin-top: 0.25rem;
    }

    /* ---- layout ---- */
    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    .main-content {
      padding: 2.5rem 0 4rem;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--navy);
      border-left: 4px solid var(--blue);
      padding-left: 0.75rem;
      margin-bottom: 1.5rem;
    }

    /* ---- article card ---- */
    .article-list {
      display: grid;
      gap: 1.25rem;
    }
    .article-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-left: 3px solid var(--blue);
      border-radius: 6px;
      padding: 1.25rem 1.5rem;
      box-shadow: var(--card-shadow);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .article-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(26,39,68,0.12);
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
    }
    .card-meta-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: auto;
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .badge {
      background: var(--blue);
      color: var(--white);
      padding: 0.15rem 0.55rem;
      border-radius: 3px;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1.45;
      margin-bottom: 0.5rem;
    }
    .card-title a { color: var(--text); }
    .card-title a:hover { color: var(--blue); text-decoration: none; }
    .original-title {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 0.35rem;
      font-style: italic;
    }
    .card-excerpt {
      font-size: 0.875rem;
      color: var(--text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-footer {
      margin-top: 0.75rem;
      font-size: 0.8rem;
    }
    .card-footer a { color: var(--text-muted); }
    .read-more {
      color: var(--blue) !important;
      font-weight: 600;
    }

    /* ---- article detail ---- */
    .article-detail {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 2rem;
      box-shadow: var(--card-shadow);
    }
    .article-detail h1 {
      font-size: clamp(1.2rem, 3vw, 1.8rem);
      font-weight: 700;
      line-height: 1.4;
      margin-bottom: 1rem;
      color: var(--navy);
    }
    .article-detail .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    .article-body {
      font-size: 0.95rem;
      line-height: 1.85;
    }
    .article-body p { margin-bottom: 1rem; }
    .article-body pre {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.85rem;
    }
    .source-box {
      margin-top: 2rem;
      padding: 1rem 1.25rem;
      background: #f8f9fb;
      border: 1px solid var(--border);
      border-left: 3px solid var(--blue);
      border-radius: 0 6px 6px 0;
      font-size: 0.875rem;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .source-box::before {
      content: '🔗';
      font-size: 0.9rem;
      flex-shrink: 0;
      margin-top: 0.05rem;
    }
    .source-box a { font-weight: 600; word-break: break-all; }

    /* ---- post-text display ---- */
    .ai-comment-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--blue);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.5rem;
    }
    .post-text-box {
      white-space: pre-wrap;
      background: #f0f4ff;
      border-left: 4px solid var(--blue);
      border-radius: 0 8px 8px 0;
      padding: 1.25rem 1.5rem;
      font-size: 0.9rem;
      line-height: 1.75;
    }

    /* ---- breadcrumb ---- */
    .breadcrumb {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 1.25rem;
    }
    .breadcrumb a { color: var(--text-muted); }

    /* ---- static pages ---- */
    .static-page {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 2rem 2.5rem;
      box-shadow: var(--card-shadow);
    }
    .static-page h1 {
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--navy);
      margin-bottom: 1.5rem;
    }
    .static-page h2 {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--navy);
      margin: 1.75rem 0 0.75rem;
    }
    .static-page p, .static-page li { font-size: 0.9rem; line-height: 1.8; margin-bottom: 0.5rem; }
    .static-page ul { padding-left: 1.4rem; }

    /* ---- footer ---- */
    .site-footer {
      background: #0f1a33;
      color: rgba(255,255,255,0.7);
      padding: 2.5rem 1.5rem 2rem;
      text-align: center;
      font-size: 0.8rem;
    }
    .footer-catchcopy {
      font-size: 0.875rem;
      color: rgba(255,255,255,0.85);
      margin-bottom: 1rem;
      font-weight: 500;
    }
    .footer-nav { margin-bottom: 0.75rem; }
    .footer-nav a { color: rgba(255,255,255,0.7); margin: 0 0.75rem; }
    .footer-nav a:hover { color: var(--white); }

    /* ---- pagination ---- */
    .pagination {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 2rem;
    }
    .pagination a, .pagination span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 4px;
      border: 1px solid var(--border);
      font-size: 0.875rem;
      background: var(--white);
      color: var(--text);
    }
    .pagination .active {
      background: var(--blue);
      color: var(--white);
      border-color: var(--blue);
      font-weight: 700;
    }

    /* ---- responsive ---- */
    @media (max-width: 768px) {
      nav a { margin-left: 0.75rem; font-size: 0.78rem; }
    }
    @media (max-width: 640px) {
      nav a { font-size: 0.72rem; margin-left: 0.5rem; }
      .article-detail { padding: 1.25rem; }
      .static-page { padding: 1.25rem; }
      .hero::after { display: none; }
    }
  </style>
</head>
<body>`;
}

function htmlHeader(base = '.') {
  return `
  <header class="site-header">
    <div class="header-inner">
      <div>
        <div class="logo-wrapper">
          <span class="logo-icon"></span>
          <div class="site-title"><a href="${base}/">${SITE_NAME}</a></div>
        </div>
        <div class="site-tagline">${SITE_DESC}</div>
      </div>
      <nav>
        <a href="${base}/">ホーム</a>
        <a href="${base}/about.html">運営者情報</a>
        <a href="${base}/privacy.html">プライバシーポリシー</a>
      </nav>
    </div>
  </header>`;
}

function htmlFooter(base = '.') {
  return `
  <footer class="site-footer">
    <div class="footer-nav">
      <a href="${base}/">ホーム</a>
      <a href="${base}/about.html">運営者情報</a>
      <a href="${base}/privacy.html">プライバシーポリシー</a>
      <a href="https://x.com/aec_news_jp" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
    </div>
    <div class="footer-catchcopy">BIM・AEC・建設DXの最新ニュースをAIが日本語で解説</div>
    <div>&copy; ${CURRENT_YEAR} ${SITE_NAME}. All rights reserved.</div>
  </footer>
</body>
</html>`;
}

// ---- index page -------------------------------------------------------------

function buildIndex(posts) {
  const recentPosts = posts.slice(0, 30);

  const cards = recentPosts.map((post) => {
    const slug = post.slug;
    const catLabel = categoryLabel(post.category);
    const date = formatDate(post.pubDate);
    const snippetText = post.postText || post.summary || '';
    const snip = excerpt(snippetText, 120);

    return `
      <article class="article-card">
        <div class="card-meta">
          <span class="badge">${escape(catLabel)}</span>
          <span class="card-meta-right"><span>${escape(post.source || '')}</span><span>${escape(date)}</span></span>
        </div>
        <h2 class="card-title">
          <a href="./posts/${escape(slug)}.html">${escape(post.titleJa || post.title)}</a>
        </h2>
        <p class="card-excerpt">${escape(snip)}</p>
        <div class="card-footer">
          <a class="read-more" href="./posts/${escape(slug)}.html">続きを読む &rarr;</a>
        </div>
      </article>`;
  }).join('');

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_DESC,
    url: SITE_URL + '/',
    inLanguage: 'ja',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL + '/',
    },
  };

  return htmlHead(
    `${SITE_NAME} | BIM・AEC・建設DXニュース`,
    SITE_DESC,
    SITE_URL + '/',
    '.',
    websiteJsonLd
  ) +
    htmlHeader() +
    `
  <div class="hero">
    <div class="hero-content">
      <h1>BIM・AEC・建設DXの最新ニュース</h1>
      <span class="hero-badge">Autodesk・IFC・デジタルツイン・建設テックの最新トレンドをAIが日本語で解説</span>
    </div>
  </div>
  <div class="container">
    <main class="main-content">
      <h2 class="section-title">最新ニュース</h2>
      <div class="article-list">
        ${cards}
      </div>
    </main>
  </div>` +
    htmlFooter();
}

// ---- article detail page ----------------------------------------------------

function buildArticlePage(post) {
  const catLabel = categoryLabel(post.category);
  const date = formatDate(post.pubDate);
  const bodyContent = post.postText
    ? `<div class="ai-comment-label">AIによる専門家コメント</div><div class="post-text-box">${escape(post.postText)}</div>`
    : `<p>${escape(post.summary || '')}</p>`;

  const pageTitle = `${post.title} | ${SITE_NAME}`;
  const descText = excerpt(post.summary || post.postText || '', 120);

  const isoDate = post.pubDate
    ? new Date(post.pubDate).toISOString()
    : new Date().toISOString();

  const newsArticleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.titleJa || post.title,
    description: descText,
    datePublished: isoDate,
    dateModified: isoDate,
    inLanguage: 'ja',
    url: `${SITE_URL}/posts/${post.slug}.html`,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL + '/',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/posts/${post.slug}.html`,
    },
  };

  return htmlHead(
    pageTitle,
    descText,
    `${SITE_URL}/posts/${post.slug}.html`,
    '..',
    newsArticleJsonLd
  ) +
    htmlHeader('..') +
    `
  <div class="container">
    <main class="main-content">
      <nav class="breadcrumb">
        <a href="../">ホーム</a> &rsaquo; <span>${escape(catLabel)}</span>
      </nav>
      <div class="article-detail">
        <h1>${escape(post.titleJa || post.title)}</h1>
        ${post.titleJa ? `<p class="original-title">${escape(post.title)}</p>` : ''}
        <div class="meta">
          <span class="badge">${escape(catLabel)}</span>
          <span>${escape(date)}</span>
          <span>出典: ${escape(post.source || '')}</span>
        </div>
        <div class="article-body">
          ${bodyContent}
        </div>
        <div class="source-box">
          元記事: <a href="${escape(post.link)}" target="_blank" rel="noopener noreferrer">${escape(post.link)}</a>
        </div>
      </div>
    </main>
  </div>` +
    htmlFooter('..');
}

// ---- privacy policy page ----------------------------------------------------

function buildPrivacyPage() {
  return htmlHead(
    `プライバシーポリシー | ${SITE_NAME}`,
    `${SITE_NAME}のプライバシーポリシーです。`,
    `${SITE_URL}/privacy.html`
  ) +
    htmlHeader() +
    `
  <div class="container">
    <main class="main-content">
      <div class="static-page">
        <h1>プライバシーポリシー</h1>

        <p>本プライバシーポリシーは、${SITE_NAME}（以下「当サイト」）における、ユーザーの個人情報の取扱いを定めるものです。</p>

        <h2>1. 個人情報の収集について</h2>
        <p>当サイトでは、お問い合わせフォーム等を通じてお名前・メールアドレス等の個人情報をご提供いただく場合があります。収集した個人情報は、お問い合わせへの回答以外の目的には使用いたしません。</p>

        <h2>2. アクセス解析ツールについて</h2>
        <p>当サイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用しています。GoogleアナリティクスはCookieを使用してデータを収集しますが、個人を特定する情報は含まれません。Cookieの無効化により収集を拒否することができます。詳細は<a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">Googleのポリシー</a>をご確認ください。</p>

        <h2>3. 広告について</h2>
        <p>当サイトでは、第三者配信の広告サービスを利用する場合があります。これらの広告配信事業者はCookieを使用してユーザーの興味に応じた広告を表示することがあります。</p>

        <h2>4. Cookieについて</h2>
        <p>当サイトでは、利便性の向上のためにCookieを使用する場合があります。ブラウザの設定からCookieを無効化することが可能ですが、一部の機能が利用できなくなる場合があります。</p>

        <h2>5. 免責事項</h2>
        <p>当サイトに掲載する情報の正確性には万全を期していますが、内容の完全性・正確性・有用性・安全性等について保証するものではありません。当サイトの情報を利用されたことによる損害については、一切責任を負いかねます。</p>

        <h2>6. 著作権</h2>
        <p>当サイトに掲載されているコンテンツ（文章・画像等）の著作権は、当サイトまたは各記事の出典元に帰属します。無断転載・複製は禁止いたします。</p>

        <h2>7. プライバシーポリシーの変更</h2>
        <p>当サイトは、必要に応じて本プライバシーポリシーを変更することがあります。重要な変更がある場合には、サイト上でお知らせします。</p>

        <h2>8. お問い合わせ</h2>
        <p>本ポリシーに関するお問い合わせは、運営者情報ページをご覧ください。</p>

        <p style="margin-top:2rem; color: var(--text-muted); font-size:0.85rem;">最終更新日: ${CURRENT_YEAR}年4月</p>
      </div>
    </main>
  </div>` +
    htmlFooter();
}

// ---- about page -------------------------------------------------------------

function buildAboutPage() {
  return htmlHead(
    `運営者情報 | ${SITE_NAME}`,
    `${SITE_NAME}の運営者情報です。`,
    `${SITE_URL}/about.html`
  ) +
    htmlHeader() +
    `
  <div class="container">
    <main class="main-content">
      <div class="static-page">
        <h1>運営者情報</h1>

        <h2>サイトについて</h2>
        <p>${SITE_NAME}は、BIM（Building Information Modeling）・AEC（建築・エンジニアリング・建設）・建設DXに関する最新ニュースを、AIを活用して日本語でわかりやすく解説する専門メディアです。</p>

        <h2>対象読者</h2>
        <ul>
          <li>BIM担当者・BIMマネージャー</li>
          <li>建設会社・設計事務所のデジタル化推進担当者</li>
          <li>AECテクノロジーに関心のある建設・不動産プロフェッショナル</li>
          <li>Autodesk Revit・ArchiCAD・Vectorworks・Rebroユーザー</li>
        </ul>

        <h2>掲載コンテンツ</h2>
        <p>当サイトはBIM・AEC関連ブログ・プレスリリース・技術記事をAIが収集・要約し、日本語で提供しています。各記事には元記事へのリンクを掲載しています。</p>

        <h2>免責事項</h2>
        <p>掲載情報は参考目的であり、内容の正確性・最新性を保証するものではありません。重要な意思決定の際は必ず元記事や一次情報をご確認ください。</p>

        <h2>著作権・引用ポリシー</h2>
        <p>当サイトの独自コンテンツの著作権は当サイトに帰属します。引用・転載の際は出典を明記の上、元記事へのリンクを設けてください。</p>

        <h2>お問い合わせ</h2>
        <p>当サイトへのお問い合わせ・記事に関するご意見は、<a href="https://x.com" target="_blank" rel="noopener noreferrer">X（旧Twitter）</a>のDMからお送りください。</p>

        <p style="margin-top:2rem; color: var(--text-muted); font-size:0.85rem;">
          &copy; ${CURRENT_YEAR} ${SITE_NAME}
        </p>
      </div>
    </main>
  </div>` +
    htmlFooter();
}

// ---- main -------------------------------------------------------------------

function main() {
  const postsFile = path.join(__dirname, 'data', 'posts.json');

  if (!fs.existsSync(postsFile)) {
    console.error('[generateSite] data/posts.json not found — skipping site generation');
    process.exit(0);
  }

  let posts;
  try {
    posts = JSON.parse(fs.readFileSync(postsFile, 'utf-8'));
  } catch (err) {
    console.error('[generateSite] Failed to parse posts.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    console.warn('[generateSite] No posts found — generating empty site');
    posts = [];
  }

  // Assign slugs
  const usedSlugs = new Map();
  posts = posts.map((post) => {
    let base = slugify(post.title || 'post');
    if (!base) base = 'post';
    let slug = base;
    let counter = 1;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${counter}`;
      counter++;
    }
    usedSlugs.set(slug, true);
    return { ...post, slug };
  });

  // Ensure posts/ directory exists
  const postsDir = path.join(__dirname, 'posts');
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }

  // Generate index.html
  fs.writeFileSync(path.join(__dirname, 'index.html'), buildIndex(posts), 'utf-8');
  console.log('[generateSite] Generated index.html');

  // Generate individual article pages
  let articleCount = 0;
  for (const post of posts) {
    const html = buildArticlePage(post);
    fs.writeFileSync(path.join(postsDir, `${post.slug}.html`), html, 'utf-8');
    articleCount++;
  }
  console.log(`[generateSite] Generated ${articleCount} article pages in posts/`);

  // Generate static pages
  fs.writeFileSync(path.join(__dirname, 'privacy.html'), buildPrivacyPage(), 'utf-8');
  console.log('[generateSite] Generated privacy.html');

  fs.writeFileSync(path.join(__dirname, 'about.html'), buildAboutPage(), 'utf-8');
  console.log('[generateSite] Generated about.html');

  // Generate sitemap.xml
  const now = new Date().toISOString().split('T')[0];
  const staticUrls = [
    { loc: `${SITE_URL}/`, lastmod: now },
    { loc: `${SITE_URL}/about.html`, lastmod: now },
    { loc: `${SITE_URL}/privacy.html`, lastmod: now },
  ];
  const articleUrls = posts.map((post) => {
    const lastmod = post.pubDate
      ? new Date(post.pubDate).toISOString().split('T')[0]
      : now;
    return { loc: `${SITE_URL}/posts/${post.slug}.html`, lastmod };
  });
  const allUrls = [...staticUrls, ...articleUrls];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemapXml, 'utf-8');
  console.log(`[generateSite] Generated sitemap.xml (${allUrls.length} URLs)`);

  // Generate robots.txt
  const robotsTxt = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(__dirname, 'robots.txt'), robotsTxt, 'utf-8');
  console.log('[generateSite] Generated robots.txt');

  console.log('[generateSite] Done.');
}

main();
