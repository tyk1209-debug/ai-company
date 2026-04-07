'use strict';

const fs = require('fs');
const path = require('path');
const { getAffiliateLinks } = require('./affiliateLinks.js');

const SITE_NAME = 'AEC News Japan';
const SITE_DESC = 'BIM・AEC・建設DXの最新ニュースをAIが日本語で解説';
const SITE_URL = 'https://aec-news.com';
const CONTACT_FORM_URL = 'https://forms.gle/kF7Jf8PErq6S15tu5';
const CURRENT_YEAR = new Date().getFullYear();
const RECOMMENDED_BOOKS = {
  REVIT: [
    {
      title: 'はじめてのAutodesk Revit＆Revit LT [Revit/Revit LT 2026対応]',
      description: 'Revit 2026 / Revit LT 2026に対応した入門書です。これから操作を学ぶ方や、基本を整理し直したい方に向いています。',
      url: 'https://amzn.to/3QpB1Ja',
    },
    {
      title: '3Dconnexion 3D CAD マウス SpaceMouse Wireless',
      description: '3D CADやBIMの視点操作を快適にしたい方向けの定番デバイスです。Revitや3Dモデルの閲覧・調整を効率化したい読者に向いています。',
      url: 'https://amzn.to/4cukegM',
    },
  ],
  BIM_ECOSYSTEM: [
    {
      title: 'Archicad28ではじめるBIM設計入門[基本・実施設計編]',
      description: 'ArchicadでBIM設計を始めたい方向けの入門書です。基本設計から実施設計までの流れを押さえやすい一冊です。',
      url: 'https://amzn.to/4tCIdjL',
    },
    {
      title: '基本から学ぶ 測量技術者のための ドローンによる写真測量とレーザ測量',
      description: 'ドローン写真測量とレーザ測量の基礎を学びたい方向けの一冊です。現場DXや3D計測に関心のある読者に向いています。',
      url: 'https://amzn.to/4veruET',
    },
    {
      title: 'ファシリティマネジメントのためのBIM要件定義',
      description: '維持管理やFMの視点からBIM要件を整理したい方向けの一冊です。運用段階まで含めたBIM活用を考える読者に向いています。',
      url: 'https://amzn.to/4cg9ZLX',
    },
  ],
  AI_DX: [
    {
      title: 'ゼネコン5.0: SDGs、DX時代の建設業の経営戦略',
      description: '建設業のDX、SDGs、経営変革を俯瞰した一冊です。建設会社のデジタル化や事業戦略に関心のある読者に向いています。',
      url: 'https://amzn.to/4tAYxl5',
    },
    {
      title: 'ロジクール MX MASTER 3S Bluetooth Edition',
      description: '長時間のリサーチや資料作成、複数アプリをまたぐ実務に向いた高機能マウスです。BIM・建設DXの情報収集や日々の制作環境を整えたい読者に向いています。',
      url: 'https://amzn.to/4dyYBNu',
    },
  ],
  GLOOBE: [
    {
      title: '企画設計からモデリング・確認申請図面までこれ一冊！ GLOOBE ArchitectではじめるBIM活用入門',
      description: 'GLOOBE ArchitectでBIM活用を始めたい方向けの実務入門書です。企画設計から確認申請図面まで一連の流れを学べます。',
      url: 'https://amzn.to/3PQRhD2',
    },
  ],
};

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
    BIM_ECOSYSTEM: 'BIM全般',
    REVIT: 'Revit',
    ARCHICAD: 'Archicad',
    IFC: 'IFC',
    DIGITAL_TWIN: 'デジタルツイン',
    CONSTRUCTION_TECH: '建設テック',
    AI: 'AI',
    AI_DX: 'AI/DX',
    BIM_AI: 'BIM×AI',
    GIS: 'GIS',
    SUSTAINABILITY: 'サステナビリティ',
    GLOOBE: 'GLOOBE',
    OTHER: 'AEC',
  };
  return map[cat] || cat || 'AEC';
}

function categorySlug(cat) {
  return cat.toLowerCase().replace(/_/g, '-');
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
  const truncatedDesc = desc && desc.length > 120 ? desc.substring(0, 119) + '…' : (desc || '');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(truncatedDesc)}">
  <link rel="canonical" href="${escape(canonical)}">
  <meta name="robots" content="index, follow, max-snippet:150, max-image-preview:large">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(truncatedDesc)}">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:image" content="${SITE_URL}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${SITE_URL}/assets/og-image.png">
  <link rel="icon" type="image/svg+xml" href="${base}/assets/favicon.svg">
  <link rel="icon" type="image/png" href="${base}/assets/favicon.png">${jsonLdScript}
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3218594531291732" crossorigin="anonymous"></script>
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-HQXDS1Z41Y"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-HQXDS1Z41Y');
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --navy: #0f172a;
      --navy-mid: #1e3a5f;
      --blue: #2563eb;
      --blue-light: #60a5fa;
      --blue-pale: rgba(37,99,235,0.08);
      --text: #111827;
      --text-muted: #6b7280;
      --text-light: #9ca3af;
      --border: #e8edf4;
      --bg: #f1f5f9;
      --white: #ffffff;
      --shadow-sm: 0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05);
      --shadow-hover: 0 14px 36px rgba(0,0,0,0.13), 0 4px 12px rgba(37,99,235,0.1);
      --radius: 12px;
      --radius-sm: 6px;
    }

    html, body { overflow-x: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue',
                   Arial, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: var(--text);
      background: var(--bg);
    }

    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ---- header ---- */
    .site-header { background: var(--navy); color: var(--white); padding: 0 1.5rem; }
    .header-inner { max-width: 1200px; margin: 0 auto; padding: 0.75rem 0; }
    .header-logo-link {
      display: inline-flex; align-items: center; gap: 0.6rem;
      text-decoration: none;
    }
    .header-logo-link:hover { text-decoration: none; opacity: 0.85; }
    .logo-img { height: 26px; width: auto; display: block; flex-shrink: 0; }
    .header-site-name {
      font-size: 1rem; font-weight: 800; color: var(--white);
      letter-spacing: 0.08em;
    }

    /* ---- hero ---- */
    .hero {
      background:
        linear-gradient(135deg, rgba(10,22,40,0.93) 0%, rgba(15,42,74,0.88) 50%, rgba(13,31,60,0.93) 100%),
        url('./assets/hero-main.png') center/cover no-repeat;
      color: var(--white);
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px);
      background-size: 64px 64px;
      pointer-events: none;
    }
    .hero-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 4rem 1.5rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      align-items: center;
      position: relative;
      z-index: 1;
    }
    .hero-label {
      display: inline-flex;
      align-items: center;
      background: rgba(37,99,235,0.18);
      border: 1px solid rgba(96,165,250,0.35);
      border-radius: 20px;
      padding: 0.3rem 1rem;
      font-size: 0.78rem;
      color: #93c5fd;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-bottom: 1.25rem;
    }
    .hero-title {
      font-size: clamp(1.6rem, 3.5vw, 2.4rem);
      font-weight: 800;
      line-height: 1.3;
      color: #fff;
      margin-bottom: 1rem;
      letter-spacing: -0.01em;
    }
    .hero-title em { color: #60a5fa; font-style: normal; }
    .hero-desc {
      font-size: 0.95rem;
      color: rgba(255,255,255,0.65);
      line-height: 1.75;
      margin-bottom: 2rem;
      max-width: 440px;
    }
    .hero-stats { display: flex; gap: 2rem; flex-wrap: wrap; }
    .hero-stat { text-align: center; }
    .hero-stat strong {
      display: block;
      font-size: 1.6rem;
      font-weight: 800;
      color: #60a5fa;
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .hero-stat span {
      display: block;
      font-size: 0.72rem;
      color: rgba(255,255,255,0.5);
      margin-top: 0.25rem;
    }
    .hero-right { display: flex; flex-direction: column; gap: 0.75rem; }
    .hero-featured-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: rgba(255,255,255,0.4);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 0.15rem;
    }
    /* hero right - main article (large) */
    .hero-main {
      display: block;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 10px;
      padding: 1.25rem;
      text-decoration: none;
      transition: background 0.2s, border-color 0.2s;
      margin-bottom: 0.75rem;
    }
    .hero-main:hover { background: rgba(255,255,255,0.13); border-color: rgba(96,165,250,0.55); text-decoration: none; }
    .hero-main-cat { font-size: 0.7rem; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.5rem; }
    .hero-main-title { font-size: 1.25rem; font-weight: 800; color: #fff; line-height: 1.4; margin-bottom: 0.5rem; }
    .hero-main-excerpt {
      font-size: 0.82rem; color: rgba(255,255,255,0.65); line-height: 1.6; margin-bottom: 0.5rem;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .hero-main-meta { font-size: 0.7rem; color: rgba(255,255,255,0.4); }
    /* hero right - sub articles (small 2-col) */
    .hero-subs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .hero-sub {
      display: block;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 0.875rem 1rem;
      text-decoration: none;
      transition: background 0.2s, border-color 0.2s;
    }
    .hero-sub:hover { background: rgba(255,255,255,0.09); border-color: rgba(96,165,250,0.4); text-decoration: none; }
    .hero-sub-cat { font-size: 0.65rem; font-weight: 700; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }
    .hero-sub-title {
      font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.85); line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .hero-sub-meta { font-size: 0.65rem; color: rgba(255,255,255,0.35); margin-top: 0.35rem; }
    .reading-time { color: var(--text-light); font-size: 0.78rem; margin-bottom: 1rem; }

    /* ---- category nav ---- */
    .category-nav-wrapper {
      background: var(--white);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .category-nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
    .category-nav {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding: 0.875rem 0;
    }
    .category-nav::-webkit-scrollbar { display: none; }
    .cat-tab {
      background: none;
      border: 1.5px solid var(--border);
      border-radius: 20px;
      padding: 0.35rem 1rem;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
      font-family: inherit;
      line-height: 1;
    }
    .cat-tab:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-pale); }
    .cat-tab.active { background: var(--blue); border-color: var(--blue); color: var(--white); }

    /* ---- layout ---- */
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
    .main-content { padding: 2.5rem 0 4rem; }
    .section-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--navy);
      border-left: 3px solid var(--blue);
      padding-left: 0.75rem;
      margin-bottom: 1.5rem;
      letter-spacing: 0.02em;
    }

    /* ---- article card ---- */
    .article-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
    .article-card {
      background: var(--white);
      border: 1px solid #e2e8f0;
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      flex-direction: column;
    }
    .article-card:hover { transform: translateY(-8px); box-shadow: var(--shadow-hover); cursor: pointer; }
    .card-thumb {
      height: 120px;
      background: linear-gradient(135deg, var(--navy-mid) 0%, var(--blue) 100%);
      position: relative;
      flex-shrink: 0;
    }
    .card-thumb-badge { position: absolute; bottom: 0.625rem; left: 0.75rem; }
    .card-thumb .badge {
      background: rgba(255,255,255,0.15);
      color: #fff;
      border-color: rgba(255,255,255,0.25);
    }
    .card-body { padding: 1.1rem 1.25rem 1.25rem; display: flex; flex-direction: column; flex: 1; }
    .card-meta { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .badge {
      display: inline-block;
      background: var(--blue-pale);
      color: var(--blue);
      border: 1px solid rgba(37,99,235,0.18);
      padding: 0.15rem 0.6rem;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }
    .card-title { font-size: 1.05rem; font-weight: 700; line-height: 1.5; margin-bottom: 0.5rem; color: var(--text); }
    .card-title a { color: inherit; }
    .card-title a:hover { color: var(--blue); text-decoration: none; }
    .original-title { font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.75rem; font-style: italic; }
    .card-excerpt {
      font-size: 0.84rem;
      color: var(--text-muted);
      line-height: 1.65;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      flex: 1;
    }
    .card-footer {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f0f2f5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .card-meta-info { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--text-light); }
    .card-meta-sep { color: var(--border); }
    .card-footer-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .read-more { color: var(--blue) !important; font-weight: 600; font-size: 0.82rem; }
    .hero-main-cta { font-size: 0.8rem; font-weight: 700; color: #60a5fa; margin-top: 0.75rem; letter-spacing: 0.03em; }
    .card-read-more {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--blue);
      text-decoration: none;
      transition: color 0.15s;
      white-space: nowrap;
    }
    .card-read-more:hover { color: #1d4ed8; text-decoration: none; }

    /* ---- share button ---- */
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      background: #1d9bf0;
      color: #fff;
      border-radius: 20px;
      padding: 0.2rem 0.7rem;
      font-size: 0.72rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .share-btn:hover { background: #1a8cd8; text-decoration: none; color: #fff; }

    /* ---- article detail ---- */
    .article-detail {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2.5rem;
      box-shadow: var(--shadow-sm);
    }
    .article-detail h1 {
      font-size: clamp(1.3rem, 3vw, 1.9rem);
      font-weight: 800;
      line-height: 1.4;
      margin-bottom: 1rem;
      color: var(--navy);
      letter-spacing: -0.01em;
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
      align-items: center;
    }
    .article-body { font-size: 1rem; line-height: 2; }
    .article-body p { margin-bottom: 1.2rem; }
    .article-body pre {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
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
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      font-size: 0.875rem;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .source-box::before {
      content: '';
      display: inline-block;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      margin-top: 0.15rem;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-size: contain;
    }
    .source-box a { font-weight: 600; word-break: break-all; }

    /* ---- affiliate box ---- */
    .affiliate-box {
      margin-top: 1.5rem;
      padding: 1rem 1.25rem;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      font-size: 0.875rem;
    }
    .affiliate-box p {
      color: #92400e;
      font-size: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .affiliate-link {
      display: block;
      color: #b45309;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    .affiliate-link:hover { color: #92400e; }

    /* ---- post-text display ---- */
    .ai-comment-label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--blue);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: 1.25rem;
      padding: 0.25rem 0.75rem;
      border: 1px solid rgba(37,99,235,0.25);
      border-radius: 20px;
      background: rgba(37,99,235,0.06);
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
    .ai-summary {
      background: transparent;
      border-left: none;
      padding: 0;
      font-size: 1rem;
      line-height: 2;
    }
    .ai-summary p { margin: 0 0 1.2rem; color: var(--text); }
    .ai-summary p:last-child { margin-bottom: 0; }
    .ai-section-header {
      margin: 2rem 0 0.75rem;
    }
    .ai-section-header:first-child { margin-top: 0; }
    .ai-section-label {
      display: inline-flex;
      align-items: center;
      background: var(--navy);
      color: #fff;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.22rem 0.85rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }
    .footer-article-count { font-size: 0.8rem; color: rgba(255,255,255,0.45); margin-bottom: 0.5rem; }

    /* ---- breadcrumb ---- */
    .breadcrumb {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 1.25rem;
    }
    .breadcrumb a { color: var(--text-muted); }

    /* ---- article hero ---- */
    .article-hero {
      color: var(--white);
      padding: 3.5rem 1.5rem 3rem;
    }
    .article-hero-inner { max-width: 820px; margin: 0 auto; }
    .article-hero-breadcrumb {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.45);
      margin-bottom: 1.25rem;
    }
    .article-hero-breadcrumb a { color: rgba(255,255,255,0.45); }
    .article-hero-breadcrumb a:hover { color: rgba(255,255,255,0.8); text-decoration: none; }
    .article-hero-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .article-hero-tag {
      display: inline-flex;
      align-items: center;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 0.22rem 0.85rem;
      border-radius: 20px;
    }
    .article-hero-tag--cat {
      background: rgba(37,99,235,0.28);
      border: 1px solid rgba(96,165,250,0.4);
      color: #93c5fd;
    }
    .article-hero-tag--source {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.65);
    }
    .article-hero-title {
      font-size: clamp(1.5rem, 3.5vw, 2.1rem);
      font-weight: 800;
      line-height: 1.38;
      color: #fff;
      margin-bottom: 1rem;
      letter-spacing: -0.01em;
    }
    .article-hero-summary {
      font-size: 0.95rem;
      color: rgba(255,255,255,0.72);
      line-height: 1.75;
      margin-bottom: 1.5rem;
      max-width: 620px;
    }
    .article-hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 1.1rem;
      font-size: 0.78rem;
      color: rgba(255,255,255,0.52);
      margin-bottom: 1.75rem;
      align-items: center;
    }
    .article-hero-meta-sep { color: rgba(255,255,255,0.2); }
    .article-hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .article-hero-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.875rem;
      font-weight: 700;
      padding: 0.6rem 1.4rem;
      border-radius: 6px;
      text-decoration: none;
      transition: all 0.15s;
    }
    .article-hero-btn--primary {
      background: var(--blue);
      color: #fff;
    }
    .article-hero-btn--primary:hover { background: #1d4ed8; color: #fff; text-decoration: none; }
    .article-hero-btn--share {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.25);
      color: rgba(255,255,255,0.85);
    }
    .article-hero-btn--share:hover { background: rgba(255,255,255,0.18); color: #fff; text-decoration: none; }

    /* ---- article layout ---- */
    .article-layout {
      display: grid;
      grid-template-columns: 1fr 260px;
      gap: 2.5rem;
      align-items: start;
      padding: 2.5rem 0 5rem;
    }
    .article-main { min-width: 0; }

    /* ---- key points card ---- */
    .article-keypoints {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      border: 1px solid rgba(96,165,250,0.2);
      border-radius: var(--radius);
      padding: 1.5rem 1.75rem;
      margin-bottom: 2rem;
    }
    .article-keypoints-title {
      font-size: 0.72rem;
      font-weight: 700;
      color: #60a5fa;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 1rem;
    }
    .article-keypoints-list {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .article-keypoints-list li {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      font-size: 0.88rem;
      line-height: 1.5;
    }
    .kp-label {
      flex-shrink: 0;
      background: rgba(37,99,235,0.35);
      border: 1px solid rgba(96,165,250,0.3);
      color: #93c5fd;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.55rem;
      border-radius: 3px;
      white-space: nowrap;
    }
    .kp-text { color: rgba(255,255,255,0.8); }

    /* ---- article body wrap ---- */
    .article-body-wrap {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem 2.5rem;
      box-shadow: var(--shadow-sm);
      margin-bottom: 1.5rem;
    }
    .ai-body-label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--blue);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 1.5rem;
      padding: 0.22rem 0.75rem;
      border: 1px solid rgba(37,99,235,0.22);
      border-radius: 20px;
      background: rgba(37,99,235,0.05);
    }
    .article-section-h2 {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--navy);
      margin: 2.25rem 0 1rem;
      padding: 0.6rem 1rem;
      background: #f1f5f9;
      border-left: 4px solid var(--blue);
      border-radius: 0 6px 6px 0;
    }
    .article-section-h2:first-child { margin-top: 0; }
    .article-section-h2 span { font-size: inherit; }

    /* ---- mid-article related card ---- */
    .mid-related-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--blue-pale);
      border: 1px solid rgba(37,99,235,0.15);
      border-left: 3px solid var(--blue);
      border-radius: 0 8px 8px 0;
      padding: 0.9rem 1.1rem;
      margin: 1.75rem 0;
    }
    .mid-related-label {
      flex-shrink: 0;
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--blue);
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }
    .mid-related-link {
      flex: 1;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--text);
      line-height: 1.4;
    }
    .mid-related-link:hover { color: var(--blue); }
    .mid-related-cat {
      flex-shrink: 0;
      font-size: 0.65rem;
      background: rgba(37,99,235,0.1);
      color: var(--blue);
      padding: 0.15rem 0.5rem;
      border-radius: 3px;
      font-weight: 600;
    }

    /* ---- editorial card ---- */
    .article-editorial {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      border-radius: 0 var(--radius) var(--radius) 0;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    .article-editorial-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.6rem;
    }
    .article-editorial-icon { font-size: 1rem; }
    .article-editorial-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .article-editorial-text {
      font-size: 0.9rem;
      line-height: 1.85;
      color: #78350f;
    }
    .article-editorial-text p { margin: 0 0 0.75rem; }
    .article-editorial-text p:last-child { margin-bottom: 0; }

    /* ---- source card ---- */
    .article-source-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .article-source-card-label {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      white-space: nowrap;
    }
    .article-source-card-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
      flex-wrap: wrap;
    }
    .article-source-card-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
    }
    .article-source-card-link {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--blue);
    }

    /* ---- tags row ---- */
    .article-tags-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }
    .article-tags-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
    }
    .article-tag {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.65rem;
      border-radius: 4px;
      background: #e2e8f0;
      color: var(--text);
      text-decoration: none;
    }
    .article-tag:hover { background: var(--blue); color: #fff; text-decoration: none; }
    .article-tag--source {
      background: #f1f5f9;
      color: var(--text-muted);
      cursor: default;
    }

    /* ---- share footer ---- */
    .article-share-footer {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem 0;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .share-btn-large {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #1d9bf0;
      color: #fff;
      border-radius: 6px;
      padding: 0.55rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.15s;
    }
    .share-btn-large:hover { background: #1a8cd8; text-decoration: none; color: #fff; }
    .back-btn { font-size: 0.875rem; color: var(--text-muted); }
    .back-btn:hover { color: var(--blue); }

    /* ---- sidebar follow widget ---- */
    .sidebar-follow {
      background: linear-gradient(135deg, var(--navy) 0%, #1e3a5f 100%);
      border-radius: var(--radius);
      padding: 1.25rem;
      text-align: center;
    }
    .sidebar-follow-title { font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
    .sidebar-follow-desc { font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 1rem; line-height: 1.5; }
    .sidebar-follow-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: #000;
      color: #fff;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.5rem 1.1rem;
      border-radius: 20px;
      text-decoration: none;
      transition: background 0.15s;
    }
    .sidebar-follow-btn:hover { background: #333; text-decoration: none; color: #fff; }

    /* ---- category hero ---- */
    .cat-hero {
      color: var(--white);
      padding: 2.5rem 1.5rem;
    }
    .cat-hero-inner { max-width: 1200px; margin: 0 auto; }
    .cat-hero-breadcrumb {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.5);
      margin-bottom: 0.75rem;
    }
    .cat-hero-breadcrumb a { color: rgba(255,255,255,0.5); }
    .cat-hero-breadcrumb a:hover { color: rgba(255,255,255,0.85); text-decoration: none; }
    .cat-hero-title {
      font-size: clamp(1.5rem, 4vw, 2.2rem);
      font-weight: 800;
      color: #fff;
      margin-bottom: 0.4rem;
    }
    .cat-hero-count { font-size: 0.875rem; color: rgba(255,255,255,0.6); }

    /* ---- static pages ---- */
    .static-page {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem 2.5rem;
      box-shadow: var(--shadow-sm);
    }
    .static-page h1 { font-size: 1.6rem; font-weight: 700; color: var(--navy); margin-bottom: 1.5rem; }
    .static-page h2 { font-size: 1.1rem; font-weight: 700; color: var(--navy); margin: 1.75rem 0 0.75rem; }
    .static-page p, .static-page li { font-size: 0.9rem; line-height: 1.8; margin-bottom: 0.5rem; }
    .static-page ul { padding-left: 1.4rem; }

    /* ---- CTA block ---- */
    .cta-block {
      background:
        linear-gradient(135deg, rgba(10,22,40,0.88) 0%, rgba(15,42,74,0.85) 100%),
        url('./assets/cta-bg.png') center/cover no-repeat;
      padding: 4rem 1.5rem;
      text-align: center;
    }
    .cta-block-inner { max-width: 640px; margin: 0 auto; }
    .cta-block-title { font-size: 1.6rem; font-weight: 800; color: #fff; margin-bottom: 0.75rem; line-height: 1.35; }
    .cta-block-desc { font-size: 0.95rem; color: rgba(255,255,255,0.72); margin-bottom: 1.75rem; line-height: 1.7; }
    .cta-block-btn {
      display: inline-block;
      background: var(--blue);
      color: #fff;
      font-weight: 700;
      font-size: 0.95rem;
      padding: 0.75rem 2rem;
      border-radius: 6px;
      text-decoration: none;
      transition: background 0.15s, transform 0.15s;
    }
    .cta-block-btn:hover { background: #1d4ed8; transform: translateY(-1px); text-decoration: none; }

    /* ---- footer ---- */
    .site-footer {
      background: #0a1628;
      color: rgba(255,255,255,0.6);
      padding: 3rem 1.5rem 2rem;
      text-align: center;
      font-size: 0.8rem;
    }
    .footer-catchcopy { font-size: 0.875rem; color: rgba(255,255,255,0.75); margin-bottom: 1.25rem; font-weight: 500; }
    .footer-nav { margin-bottom: 1rem; }
    .footer-nav a { color: rgba(255,255,255,0.55); margin: 0 0.75rem; transition: color 0.15s; }
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


    /* ---- sidebar ---- */
    .content-with-sidebar { display: grid; grid-template-columns: 1fr 280px; gap: 2.5rem; align-items: start; }
    .sidebar { position: sticky; top: 4.5rem; }
    .sidebar-widget {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
      box-shadow: var(--shadow-sm);
      margin-bottom: 1.25rem;
    }
    .sidebar-widget-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--navy);
      border-left: 3px solid var(--blue);
      padding-left: 0.6rem;
      margin-bottom: 1rem;
      letter-spacing: 0.03em;
    }
    .sidebar-category-list { list-style: none; padding: 0; margin: 0; }
    .sidebar-category-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem 0;
      border-bottom: 1px solid #f5f7fa;
      font-size: 0.82rem;
    }
    .sidebar-category-list li:last-child { border-bottom: none; }
    .sidebar-category-list a { color: var(--text); }
    .sidebar-category-list a:hover { color: var(--blue); text-decoration: none; }
    .sidebar-category-count {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 0.1rem 0.5rem;
      font-size: 0.7rem;
      color: var(--text-muted);
    }
    .sidebar-popular-list { list-style: none; padding: 0; margin: 0; }
    .sidebar-popular-list li { padding: 0.45rem 0; border-bottom: 1px solid #f5f7fa; font-size: 0.8rem; line-height: 1.5; }
    .sidebar-popular-list li:last-child { border-bottom: none; }
    .sidebar-popular-list a { color: var(--text); display: flex; align-items: flex-start; gap: 0.5rem; }
    .sidebar-popular-list a:hover { color: var(--blue); text-decoration: none; }
    .sidebar-rank {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; min-width: 18px;
      background: var(--blue); color: #fff;
      border-radius: 4px; font-size: 0.65rem; font-weight: 800;
      margin-top: 0.1rem;
    }
    .sidebar-popular-list li:nth-child(1) .sidebar-rank { background: #f59e0b; }
    .sidebar-popular-list li:nth-child(2) .sidebar-rank { background: #94a3b8; }
    .sidebar-popular-list li:nth-child(3) .sidebar-rank { background: #b45309; }
    .sidebar-about { font-size: 0.82rem; line-height: 1.75; color: var(--text-muted); }
    .sidebar-recent-list { list-style: none; padding: 0; margin: 0; }
    .sidebar-recent-list li { padding: 0.45rem 0; border-bottom: 1px solid #f5f7fa; font-size: 0.8rem; line-height: 1.5; }
    .sidebar-recent-list li:last-child { border-bottom: none; }
    .sidebar-recent-list a { color: var(--text); }
    .sidebar-recent-list a:hover { color: var(--blue); text-decoration: none; }

    /* ---- pagination ---- */
    .pagination { display: flex; justify-content: center; gap: 0.5rem; margin-top: 2rem; }
    .pagination a, .pagination span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      font-size: 0.875rem;
      background: var(--white);
      color: var(--text);
    }
    .pagination .active { background: var(--blue); color: var(--white); border-color: var(--blue); font-weight: 700; }

    /* ---- featured section ---- */
    .featured-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 1.25rem;
      margin-bottom: 3rem;
    }
    .featured-main { grid-row: 1 / 3; }
    .featured-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      flex-direction: column;
      cursor: pointer;
    }
    .featured-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-hover); }
    .featured-thumb {
      height: 140px;
      background: linear-gradient(135deg, var(--navy-mid) 0%, var(--blue) 100%);
      position: relative;
      display: flex;
      align-items: flex-end;
      padding: 0.75rem;
      flex-shrink: 0;
    }
    .featured-main .featured-thumb { height: 220px; }
    .featured-body { padding: 1.1rem 1.25rem 1.25rem; flex: 1; display: flex; flex-direction: column; }
    .featured-title { font-size: 1rem; font-weight: 700; line-height: 1.5; margin-bottom: 0.5rem; color: var(--text); }
    .featured-main .featured-title { font-size: 1.15rem; font-weight: 800; }
    .featured-title a { color: inherit; }
    .featured-title a:hover { color: var(--blue); text-decoration: none; }
    .featured-excerpt {
      font-size: 0.84rem; color: var(--text-muted); line-height: 1.65; margin-bottom: 0.75rem;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1;
    }
    .featured-meta { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--text-light); }
    .latest-section-title { margin-top: 0.5rem; }

    /* ---- responsive ---- */
    @media (max-width: 900px) {
      .hero-inner { grid-template-columns: 1fr; gap: 2rem; padding: 3rem 1.5rem; }
      .hero-right { max-width: 560px; }
      .featured-grid { grid-template-columns: 1fr; }
      .featured-main { grid-row: auto; }
      .content-with-sidebar { grid-template-columns: 1fr; }
      .sidebar { position: static; top: 0; }
      .article-layout { grid-template-columns: 1fr; padding: 1.5rem 0 3rem; }
      .article-body-wrap { padding: 1.25rem 1.5rem; }
      .article-hero-actions { gap: 0.5rem; }
      .article-keypoints { padding: 1.25rem; }
    }
    @media (max-width: 640px) {
      .article-list { grid-template-columns: 1fr; }
      .hero-subs { grid-template-columns: 1fr; }
      nav a { margin-left: 0.75rem; font-size: 0.78rem; }
      nav a.nav-hide-sp { display: none; }
      .article-detail { padding: 1.5rem; }
      .static-page { padding: 1.25rem; }
      .site-tagline { display: none; }
    }
    @media (max-width: 480px) {
      nav a { font-size: 0.75rem; margin-left: 0.6rem; }
      .hero-stats { gap: 1.25rem; }
    }
  </style>
</head>
<body>`;
}

function htmlHeader(base = '.') {
  return `
  <header class="site-header">
    <div class="header-inner">
      <a href="${base}/" class="header-logo-link">
        <img src="${base}/assets/logo.svg" alt="${SITE_NAME}" class="logo-img">
      </a>
    </div>
  </header>`;
}

function htmlFooter(base = '.', articleCount = 0) {
  const countLine = articleCount > 0
    ? `<div class="footer-article-count">累計 ${articleCount} 記事を掲載</div>`
    : '';
  return `
  <footer class="site-footer">
    <div class="footer-nav">
      <a href="${base}/">ホーム</a>
      <a href="${base}/events.html">イベント</a>
      <a href="${base}/about.html">運営者情報</a>
      <a href="${base}/privacy.html">プライバシーポリシー</a>
    </div>
    <div class="footer-catchcopy">BIM・AEC・建設DXの最新ニュースをAIが日本語で解説</div>
    ${countLine}
    <div>&copy; ${CURRENT_YEAR} ${SITE_NAME}. All rights reserved.</div>
  </footer>
</body>
</html>`;
}

// ---- sidebar ----------------------------------------------------------------

function buildRecommendedBooks(categoryKey) {
  const books = RECOMMENDED_BOOKS[categoryKey] || [];
  if (books.length === 0) return '';

  const items = books.map((book) => `
      <div class="sidebar-widget">
        <div class="sidebar-widget-title">おすすめ書籍</div>
        <p class="sidebar-about" style="margin-bottom:0.75rem; color: var(--text); font-weight:700;">${escape(book.title)}</p>
        <p class="sidebar-about" style="margin-bottom:0.85rem;">${escape(book.description)}</p>
        <a class="sidebar-follow-btn" href="${escape(book.url)}" target="_blank" rel="noopener noreferrer sponsored">Amazonで見る</a>
      </div>`).join('');

  return items;
}

function buildSidebar(posts, base = '.') {
  // Category counts
  const catCounts = {};
  for (const p of posts) {
    const label = categoryLabel(p.category);
    catCounts[label] = (catCounts[label] || 0) + 1;
  }
  const catData = {};
  for (const p of posts) {
    const key = (p.category || 'OTHER').toUpperCase();
    const label = categoryLabel(p.category);
    if (!catData[key]) catData[key] = { label, count: 0 };
    catData[key].count++;
  }
  const catItems = Object.entries(catData)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, { label, count }]) =>
      `<li><a href="${base}/categories/${categorySlug(key)}.html">${escape(label)}</a><span class="sidebar-category-count">${count}</span></li>`
    ).join('');

  // Recent 5 posts
  const recent = posts.slice(0, 5);
  const recentItems = recent.map(p =>
    `<li><a href="${base}/posts/${escape(p.slug)}.html">${escape(p.titleJa || p.title)}</a></li>`
  ).join('');

  // Weekly digest posts (isWeekly === true), most recent 5
  const weeklyPosts = posts
    .filter((p) => p.isWeekly === true)
    .slice(0, 5);
  const weeklyWidget = weeklyPosts.length > 0
    ? `
      <div class="sidebar-widget">
        <div class="sidebar-widget-title">週次まとめ</div>
        <ul class="sidebar-recent-list">
          ${weeklyPosts.map((p) =>
            `<li><a href="${base}/posts/${escape(p.slug)}.html">${escape(p.titleJa || p.title)}</a></li>`
          ).join('')}
        </ul>
      </div>`
    : '';

  // Popular articles: top 5 by index (proxy for importance/recency)
  const popularItems = posts.slice(0, 5).map((p, i) =>
    `<li>
      <a href="${base}/posts/${escape(p.slug)}.html">
        <span class="sidebar-rank">${i + 1}</span>${escape(p.titleJa || p.title)}
      </a>
    </li>`
  ).join('');

  return `
    <aside class="sidebar">
      <div class="sidebar-widget">
        <div class="sidebar-widget-title">人気記事</div>
        <ul class="sidebar-popular-list">${popularItems}</ul>
      </div>
      <div class="sidebar-widget">
        <div class="sidebar-widget-title">カテゴリ</div>
        <ul class="sidebar-category-list">${catItems}</ul>
      </div>
      <div class="sidebar-widget">
        <div class="sidebar-widget-title">最新記事</div>
        <ul class="sidebar-recent-list">${recentItems}</ul>
      </div>
      <div class="sidebar-widget">
        <div class="sidebar-widget-title">このサイトについて</div>
        <p class="sidebar-about">AEC News JapanはBIM・AEC・建設DXの最新情報をAIが日本語で解説する専門メディアです。</p>
      </div>${weeklyWidget}
    </aside>`;
}

// ---- index page -------------------------------------------------------------

// カテゴリ別サムネイル画像マップ（画像があれば優先、なければグラデ）
const THUMB_IMAGES = {
  REVIT: './assets/Cyclone-3DR-BIM-Analysis-1600x856-06.jpg',
  BIM_ECOSYSTEM: './assets/Cyclone-3DR-BIM-Analysis-1600x856-06.jpg',
  BIM_AI: './assets/csm_KI_Bau_2a4ab20acc.jpg',
  CONSTRUCTION_TECH: './assets/csm_KI_Bau_2a4ab20acc.jpg',
  AI_DX: './assets/blue-ai-digital-cube.jpg',
  AI: './assets/blue-ai-digital-cube.jpg',
  DIGITAL_TWIN: './assets/Arups__Digital_Twins_of_Water_Cube_Pilot_PMlBC2aLE.jpeg',
  IFC: './assets/blueprint3_smart_cities_Adobe_rt.jpg',
  GIS: './assets/blueprint3_smart_cities_Adobe_rt.jpg',
};

const THUMB_GRADIENTS = {
  REVIT: 'linear-gradient(135deg, rgba(30,58,95,0.55) 0%, rgba(14,165,233,0.55) 100%)',
  ARCHICAD: 'linear-gradient(135deg, #143a2a 0%, #10b981 100%)',
  BIM_AI: 'linear-gradient(135deg, rgba(45,27,105,0.55) 0%, rgba(124,58,237,0.55) 100%)',
  AI_DX: 'linear-gradient(135deg, rgba(45,27,105,0.55) 0%, rgba(139,92,246,0.55) 100%)',
  AI: 'linear-gradient(135deg, rgba(45,27,105,0.55) 0%, rgba(167,139,250,0.55) 100%)',
  IFC: 'linear-gradient(135deg, rgba(30,58,95,0.55) 0%, rgba(6,182,212,0.55) 100%)',
  GLOOBE: 'linear-gradient(135deg, #1a3a2a 0%, #059669 100%)',
  DIGITAL_TWIN: 'linear-gradient(135deg, rgba(15,41,66,0.45) 0%, rgba(59,130,246,0.45) 100%)',
  CONSTRUCTION_TECH: 'linear-gradient(135deg, rgba(45,27,105,0.45) 0%, rgba(124,58,237,0.45) 100%)',
  GIS: 'linear-gradient(135deg, rgba(30,58,95,0.55) 0%, rgba(2,132,199,0.55) 100%)',
  SUSTAINABILITY: 'linear-gradient(135deg, #0a3020 0%, #16a34a 100%)',
  BIM_ECOSYSTEM: 'linear-gradient(135deg, rgba(30,58,95,0.55) 0%, rgba(59,130,246,0.55) 100%)',
};

function thumbStyle(catKey, base = '.') {
  const img = THUMB_IMAGES[catKey];
  const grad = THUMB_GRADIENTS[catKey] || 'linear-gradient(135deg, rgba(30,58,95,0.7) 0%, rgba(37,99,235,0.7) 100%)';
  if (img) {
    return `background: ${grad}, url('${img.replace('./assets/', base + '/assets/')}') center/cover no-repeat;`;
  }
  // プレースホルダー画像
  return `background: ${grad}, url('${base}/assets/Getting-real-about-technology-part-1.webp') center/cover no-repeat;`;
}

function buildIndex(posts, totalCount = 0) {
  const recentPosts = posts.slice(0, 30);
  const articleCount = totalCount || posts.length;

  // Hero: post[0] as main, posts[1-2] as subs
  const heroMain = posts[0];
  const heroMainHtml = heroMain ? `
      <a class="hero-main" href="./posts/${escape(heroMain.slug)}.html">
        <div class="hero-main-cat">${escape(categoryLabel(heroMain.category))}</div>
        <div class="hero-main-title">${escape(heroMain.titleJa || heroMain.title)}</div>
        <div class="hero-main-excerpt">${escape(excerpt(heroMain.bodyJa || heroMain.postText || heroMain.summary || '', 85))}</div>
        <div class="hero-main-meta">${escape(heroMain.source || '')} · ${escape(formatDate(heroMain.pubDate))}</div>
        <div class="hero-main-cta">続きを読む →</div>
      </a>` : '';
  const heroSubsHtml = `
      <div class="hero-subs">
        ${posts.slice(1, 3).map(post => `
        <a class="hero-sub" href="./posts/${escape(post.slug)}.html">
          <div class="hero-sub-cat">${escape(categoryLabel(post.category))}</div>
          <div class="hero-sub-title">${escape(post.titleJa || post.title)}</div>
          <div class="hero-sub-meta">${escape(post.source || '')} · ${escape(formatDate(post.pubDate))}</div>
        </a>`).join('')}
      </div>`;

  // 注目記事: posts 0-2 as featured cards (magazine layout)
  const featuredCards = posts.slice(0, 3).map((post, i) => {
    const catKey = (post.category || 'OTHER').toUpperCase();
    const ts = thumbStyle(catKey);
    const isMain = i === 0;
    const snip = excerpt(post.bodyJa || post.postText || post.summary || '', 90);
    return `
      <article class="featured-card${isMain ? ' featured-main' : ''}">
        <div class="featured-thumb" style="${ts}">
          <span class="badge">${escape(categoryLabel(post.category))}</span>
        </div>
        <div class="featured-body">
          <h3 class="featured-title">
            <a href="./posts/${escape(post.slug)}.html">${escape(post.titleJa || post.title)}</a>
          </h3>
          ${isMain ? `<p class="featured-excerpt">${escape(snip)}</p>` : ''}
          <div class="featured-meta">
            <span>${escape(post.source || '')}</span>
            <span class="card-meta-sep">·</span>
            <span>${escape(formatDate(post.pubDate))}</span>
          </div>
        </div>
      </article>`;
  }).join('');

  // 最新ニュース: posts 3+ (no duplication with featured)
  const latestPosts = posts.slice(3, 27);

  const cards = latestPosts.map((post) => {
    const slug = post.slug;
    const catLabel = categoryLabel(post.category);
    const catKey = (post.category || 'OTHER').toUpperCase();
    const date = formatDate(post.pubDate);
    const snippetText = post.bodyJa || post.postText || post.summary || '';
    const snip = excerpt(snippetText, 100);
    const ts2 = thumbStyle(catKey);

    return `
      <article class="article-card" data-category="${escape(catKey)}">
        <div class="card-thumb" style="${ts2}">
          <div class="card-thumb-badge"><span class="badge">${escape(catLabel)}</span></div>
        </div>
        <div class="card-body">
          <h2 class="card-title">
            <a href="./posts/${escape(slug)}.html">${escape(post.titleJa || post.title)}</a>
          </h2>
          <p class="card-excerpt">${escape(snip)}</p>
          <div class="card-footer">
            <div class="card-meta-info">
              <span>${escape(post.source || '')}</span>
              <span class="card-meta-sep">·</span>
              <span>${escape(date)}</span>
            </div>
            <a class="card-read-more" href="./posts/${escape(slug)}.html">続きを読む →</a>
            <a class="share-btn" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.titleJa || post.title)}&url=${encodeURIComponent(SITE_URL + '/posts/' + slug + '.html')}" target="_blank" rel="noopener noreferrer">X</a>
          </div>
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

  const categoryNavHtml = `
  <div class="category-nav-wrapper">
    <div class="category-nav-inner">
      <div class="category-nav" id="categoryNav">
        <button class="cat-tab active" data-filter="ALL">すべて</button>
        <button class="cat-tab" data-filter="REVIT">Revit</button>
        <button class="cat-tab" data-filter="ARCHICAD">Archicad</button>
        <button class="cat-tab" data-filter="BIM_ECOSYSTEM">BIM全般</button>
        <button class="cat-tab" data-filter="AI_DX,BIM_AI,AI">AI/DX</button>
        <button class="cat-tab" data-filter="IFC">IFC</button>
        <button class="cat-tab" data-filter="GLOOBE">GLOOBE</button>
        <button class="cat-tab" data-filter="CONSTRUCTION_TECH">建設テック</button>
      </div>
    </div>
  </div>
  <script>
    (function() {
      var nav = document.getElementById('categoryNav');
      if (!nav) return;
      nav.addEventListener('click', function(e) {
        var btn = e.target.closest('.cat-tab');
        if (!btn) return;
        nav.querySelectorAll('.cat-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var filter = btn.getAttribute('data-filter');
        var filters = filter === 'ALL' ? null : filter.split(',');
        document.querySelectorAll('.article-card').forEach(function(card) {
          if (!filters) {
            card.style.display = '';
          } else {
            var cat = card.getAttribute('data-category') || '';
            card.style.display = filters.indexOf(cat) !== -1 ? '' : 'none';
          }
        });
      });
    })();
  </script>`;

  return htmlHead(
    `${SITE_NAME} | BIM・AEC・建設DXニュース`,
    SITE_DESC,
    SITE_URL + '/',
    '.',
    websiteJsonLd
  ) +
    htmlHeader() +
    `
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-left">
        <div class="hero-label">BIM × AI ニュースメディア</div>
        <h1 class="hero-title">BIM・AEC・建設DXの<br>最新ニュースを<em>AIが毎日解説</em></h1>
        <p class="hero-desc">世界中のBIM・AECニュースを専門AIが編集・翻訳。Revit、Archicad、IFC、建設テック最新動向をお届けします。</p>
        <div class="hero-stats">
          <div class="hero-stat"><strong>${articleCount}</strong><span>専門記事</span></div>
          <div class="hero-stat"><strong>毎日</strong><span>更新</span></div>
          <div class="hero-stat"><strong>AI</strong><span>解説付き</span></div>
        </div>
      </div>
      <div class="hero-right">
        <div class="hero-featured-label">注目記事</div>
        ${heroMainHtml}
        ${heroSubsHtml}
      </div>
    </div>
  </section>` +
    categoryNavHtml +
    `
  <div class="container">
    <div class="content-with-sidebar" style="padding: 2.5rem 0 4rem;">
      <main>
        <h2 class="section-title">最新ニュース</h2>
        <div class="article-list">
          ${cards}
        </div>
      </main>
      ${buildSidebar(posts, '.')}
    </div>
  </div>
  <section class="cta-block">
    <div class="cta-block-inner">
      <div class="cta-block-text">
        <h2 class="cta-block-title">BIM・AECの最前線を、毎日チェック</h2>
        <p class="cta-block-desc">世界中の専門ニュースをAIが日本語で編集。Revit・Archicad・IFC・建設DXの動向を無料でお届けします。</p>
        <a class="cta-block-btn" href="./about.html">このサイトについて →</a>
      </div>
    </div>
  </section>` +
    htmlFooter('.', articleCount);
}

// ---- parse bodyJa into structured sections -----------------------------------

function parseBodySections(bodyJa) {
  if (!bodyJa) return [];
  const lines = bodyJa.split(/\n+/).filter(s => s.trim());
  const sections = [];
  let current = { label: null, paragraphs: [] };
  for (const line of lines) {
    const trimmed = line.trim();
    const soloM = /^【([^】]+)】$/.exec(trimmed);
    const inlineM = /^【([^】]+)】(.+)$/.exec(trimmed);
    if (soloM) {
      if (current.label || current.paragraphs.length > 0) sections.push(current);
      current = { label: soloM[1], paragraphs: [] };
    } else if (inlineM) {
      if (current.label || current.paragraphs.length > 0) sections.push(current);
      current = { label: inlineM[1], paragraphs: [inlineM[2].trim()] };
    } else {
      current.paragraphs.push(trimmed);
    }
  }
  if (current.label || current.paragraphs.length > 0) sections.push(current);
  return sections;
}

// ---- article detail page ----------------------------------------------------

function buildRelatedArticles(post, allPosts, sectionTitle = '関連記事') {
  if (!allPosts || allPosts.length === 0) return '';
  const related = allPosts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);
  if (related.length === 0) return '';
  const cards = related.map((p) => {
    const catKey = (p.category || 'OTHER').toUpperCase();
    const ts = thumbStyle(catKey, '..');
    const snip = excerpt(p.bodyJa || p.postText || p.summary || '', 80);
    return `
      <article class="article-card">
        <div class="card-thumb" style="${ts}">
          <div class="card-thumb-badge"><span class="badge">${escape(categoryLabel(p.category))}</span></div>
        </div>
        <div class="card-body">
          <h3 class="card-title" style="font-size:0.95rem;">
            <a href="../posts/${escape(p.slug)}.html">${escape(p.titleJa || p.title)}</a>
          </h3>
          <p class="card-excerpt">${escape(snip)}</p>
          <div class="card-footer">
            <div class="card-meta-info"><span>${escape(p.source || '')}</span><span class="card-meta-sep">·</span><span>${escape(formatDate(p.pubDate))}</span></div>
            <a class="card-read-more" href="../posts/${escape(p.slug)}.html">続きを読む →</a>
          </div>
        </div>
      </article>`;
  }).join('');
  return `
      <div class="related-articles">
        <h2 class="section-title" style="margin-top:2.5rem;">${escape(sectionTitle)}</h2>
        <div class="article-list">${cards}</div>
      </div>`;
}

function buildArticlePage(post, allPosts) {
  const catLabel = categoryLabel(post.category);
  const catKey = (post.category || 'OTHER').toUpperCase();
  const date = formatDate(post.pubDate);
  const bodyText = post.bodyJa || post.postText || post.summary || '';
  const readingMinutes = Math.max(1, Math.ceil(bodyText.length / 500));

  // ---- structured sections ----
  const sections = parseBodySections(post.bodyJa);

  // ---- key points from sections ----
  const keyPoints = sections
    .filter(s => s.label && s.paragraphs.length > 0)
    .map(s => {
      // 最初の文（。区切り）を完全に表示。ない場合は最初の段落全体
      const firstSent = s.paragraphs[0].split('。')[0];
      const text = firstSent.length > 0 ? firstSent + '。' : s.paragraphs[0];
      return { label: s.label, text };
    })
    .slice(0, 5);

  // ---- editorial section (日本への影響 or last section) ----
  const editLabels = ['日本への影響', '日本市場', '日本', '見解', 'まとめ', '考察', '影響'];
  const editSection = sections.find(s => s.label && editLabels.some(l => s.label.includes(l)) && s.paragraphs.length > 0)
    || (sections.length > 1 ? sections[sections.length - 1] : null);
  // セクションの全段落を表示（途切れ防止）
  const editorialText = editSection && editSection.paragraphs.length > 0
    ? editSection.paragraphs.join('\n')
    : '';

  // ---- body HTML ----
  const midPost = allPosts.find(p => p.slug !== post.slug && p.category === post.category);
  const midCardHtml = midPost ? `
    <div class="mid-related-card">
      <span class="mid-related-label">関連記事</span>
      <a class="mid-related-link" href="../posts/${escape(midPost.slug)}.html">${escape(midPost.titleJa || midPost.title)}</a>
      <span class="mid-related-cat">${escape(categoryLabel(midPost.category))}</span>
    </div>` : '';

  let bodyHtml = '';
  if (post.bodyJa) {
    let sIdx = 0;
    for (const sec of sections) {
      if (sec.label) {
        bodyHtml += `<h2 class="article-section-h2"><span>${escape(sec.label)}</span></h2>`;
      }
      bodyHtml += sec.paragraphs.map(p => `<p>${escape(p)}</p>`).join('\n');
      sIdx++;
      if (sIdx === 2 && midCardHtml) bodyHtml += midCardHtml;
    }
  } else if (post.postText) {
    bodyHtml = `<div class="ai-body-text" style="white-space:pre-wrap;font-size:1rem;line-height:2;">${escape(post.postText)}</div>`;
  } else {
    bodyHtml = `<p>${escape(post.summary || '')}</p>`;
  }

  // ---- affiliate ----
  const affiliates = getAffiliateLinks(post);
  const affiliateHtml = affiliates.length > 0 ? `
    <div class="affiliate-box">
      <p>※ 本記事に関連する書籍・学習リソース（広告）</p>
      ${affiliates.map(a => `<a href="${escape(a.url)}" target="_blank" rel="noopener sponsored" class="affiliate-link">📚 ${escape(a.title)} を Amazonで見る →</a>`).join('')}
    </div>` : '';

  // ---- key points card ----
  const keypointsHtml = keyPoints.length > 0 ? `
    <div class="article-keypoints">
      <div class="article-keypoints-title">この記事の要点</div>
      <ul class="article-keypoints-list">
        ${keyPoints.map(kp => `<li><span class="kp-label">${escape(kp.label)}</span><span class="kp-text">${escape(kp.text)}</span></li>`).join('')}
      </ul>
    </div>` : '';

  // ---- editorial card ----
  const editorialHtml = editorialText ? `
    <div class="article-editorial">
      <div class="article-editorial-header">
        <span class="article-editorial-icon">💡</span>
        <span class="article-editorial-title">AEC News Japan 編集部の見解</span>
      </div>
      <div class="article-editorial-text">${editorialText.split('\n').filter(s => s.trim()).map(p => `<p>${escape(p)}</p>`).join('')}</div>
    </div>` : '';

  // ---- hero summary ----
  const heroSummaryText = post.summary
    ? excerpt(post.summary, 130)
    : sections.length > 0 && sections[0].paragraphs.length > 0
      ? excerpt(sections[0].paragraphs[0], 130)
      : '';

  const pageTitle = `${post.titleJa || post.title} | ${SITE_NAME}`;
  const descText = excerpt(post.summary || post.postText || bodyText, 120);
  const heroImg = (THUMB_IMAGES[catKey] || './assets/Getting-real-about-technology-part-1.webp').replace('./assets/', '../assets/');
  const heroBg = `linear-gradient(135deg, rgba(10,22,40,0.87) 0%, rgba(15,42,74,0.83) 100%), url('${heroImg}') center/cover no-repeat`;
  const catSlugStr = categorySlug(post.category || 'OTHER');
  const shareUrl = SITE_URL + '/posts/' + post.slug + '.html';

  const isoDate = post.pubDate ? new Date(post.pubDate).toISOString() : new Date().toISOString();
  const newsArticleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.titleJa || post.title,
    description: descText,
    datePublished: isoDate,
    dateModified: isoDate,
    inLanguage: 'ja',
    url: shareUrl,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL + '/' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': shareUrl },
  };

  return htmlHead(pageTitle, descText, shareUrl, '..', newsArticleJsonLd) +
    htmlHeader('..') +
    `
  <div class="article-hero" style="background: ${heroBg};">
    <div class="article-hero-inner">
      <nav class="article-hero-breadcrumb">
        <a href="../">ホーム</a> › <a href="../categories/${catSlugStr}.html">${escape(catLabel)}</a>
      </nav>
      <div class="article-hero-tags">
        <span class="article-hero-tag article-hero-tag--cat">${escape(catLabel)}</span>
        ${post.source ? `<span class="article-hero-tag article-hero-tag--source">${escape(post.source)}</span>` : ''}
      </div>
      <h1 class="article-hero-title">${escape(post.titleJa || post.title)}</h1>
      ${heroSummaryText ? `<p class="article-hero-summary">${escape(heroSummaryText)}</p>` : ''}
      <div class="article-hero-meta">
        <span>📅 ${escape(date)}</span>
        <span class="article-hero-meta-sep">·</span>
        <span>⏱ 約${readingMinutes}分</span>
        <span class="article-hero-meta-sep">·</span>
        <span>出典: ${escape(post.source || '')}</span>
      </div>
      <div class="article-hero-actions">
        <a class="article-hero-btn article-hero-btn--primary" href="${escape(post.link)}" target="_blank" rel="noopener noreferrer">原文を読む →</a>
        <a class="article-hero-btn article-hero-btn--share" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.titleJa || post.title)}&url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener noreferrer">𝕏 シェア</a>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="article-layout">
      <main class="article-main">
        ${keypointsHtml}
        <div class="article-body-wrap">
          <div class="ai-body-label">AI による日本語解説</div>
          <div class="article-body">
            ${bodyHtml}
          </div>
        </div>
        ${editorialHtml}
        ${affiliateHtml}
        <div class="article-source-card">
          <span class="article-source-card-label">元記事・出典</span>
          <div class="article-source-card-info">
            <span class="article-source-card-name">${escape(post.source || '不明')}</span>
            <a href="${escape(post.link)}" target="_blank" rel="noopener noreferrer" class="article-source-card-link">原文を読む →</a>
          </div>
        </div>
        <div class="article-tags-row">
          <span class="article-tags-label">タグ:</span>
          <a class="article-tag" href="../categories/${catSlugStr}.html">${escape(catLabel)}</a>
          ${post.source ? `<span class="article-tag article-tag--source">${escape(post.source)}</span>` : ''}
        </div>
        <div class="article-share-footer">
          <a class="share-btn-large" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.titleJa || post.title)}&url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener noreferrer">𝕏 でシェアする</a>
          <a class="back-btn" href="../">← 記事一覧に戻る</a>
        </div>
        ${buildRelatedArticles(post, allPosts, '次に読むべき記事')}
      </main>
      ${buildSidebar(allPosts, '..')}
    </div>
  </div>
  <script>
    (function() {
      var fired = false;
      function onScroll() {
        if (fired) return;
        var scrolled = window.scrollY + window.innerHeight;
        var total = document.documentElement.scrollHeight;
        if (total > 0 && scrolled / total >= 0.5) {
          fired = true;
          if (typeof gtag === 'function') gtag('event', 'scroll_50', { event_category: 'engagement' });
          window.removeEventListener('scroll', onScroll);
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true });
    })();
  </script>` +
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
        <p>また、記事内や今後掲載する特集において、アフィリエイトリンクや広告リンクを使用する場合があります。広告・提携リンクを含むコンテンツは、読者に誤解を与えないよう配慮して掲載します。</p>

        <h2>4. Cookieについて</h2>
        <p>当サイトでは、利便性の向上のためにCookieを使用する場合があります。ブラウザの設定からCookieを無効化することが可能ですが、一部の機能が利用できなくなる場合があります。</p>

        <h2>5. 免責事項</h2>
        <p>当サイトに掲載する情報の正確性には万全を期していますが、内容の完全性・正確性・有用性・安全性等について保証するものではありません。当サイトの情報を利用されたことによる損害については、一切責任を負いかねます。</p>

        <h2>6. 著作権</h2>
        <p>当サイトに掲載されているコンテンツ（文章・画像等）の著作権は、当サイトまたは各記事の出典元に帰属します。無断転載・複製は禁止いたします。</p>

        <h2>7. プライバシーポリシーの変更</h2>
        <p>当サイトは、必要に応じて本プライバシーポリシーを変更することがあります。重要な変更がある場合には、サイト上でお知らせします。</p>

        <h2>8. お問い合わせ</h2>
        <p>本ポリシーに関するお問い合わせは、<a href="${CONTACT_FORM_URL}" target="_blank" rel="noopener noreferrer">お問い合わせフォーム</a>よりご連絡ください。</p>

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
          <li>Autodesk Revit・Archicad・Vectorworks・Rebroユーザー</li>
        </ul>

        <h2>掲載コンテンツ</h2>
        <p>当サイトはBIM・AEC関連ブログ・プレスリリース・技術記事をAIが収集・要約し、日本語で提供しています。各記事には元記事へのリンクを掲載しています。</p>

        <h2>編集方針</h2>
        <p>当サイトは、単なる翻訳ではなく、日本のBIM・AEC実務にとって重要かどうかを基準に記事を編集しています。特に「何が起きたか」「なぜ重要か」「日本の実務にどう影響するか」を重視し、読者が短時間で判断材料を得られる構成を目指しています。</p>

        <h2>AI利用ポリシー</h2>
        <p>当サイトでは、記事候補の収集、要約草案、日本語化の一部にAIを活用しています。ただし、公開内容は一次情報へのリンクを明示し、専門メディアとしての可読性と妥当性を重視して整形しています。重要な判断や導入検討の際は、必ず元記事・公式発表・製品情報をご確認ください。</p>

        <h2>広告・アフィリエイト方針</h2>
        <p>当サイトでは、運営費の一部をまかなうために広告やアフィリエイトリンクを利用する場合があります。広告や提携リンクの有無によって記事の評価基準を変更することはなく、読者価値を最優先に編集します。</p>

        <h2>免責事項</h2>
        <p>掲載情報は参考目的であり、内容の正確性・最新性を保証するものではありません。重要な意思決定の際は必ず元記事や一次情報をご確認ください。</p>

        <h2>著作権・引用ポリシー</h2>
        <p>当サイトの独自コンテンツの著作権は当サイトに帰属します。引用・転載の際は出典を明記の上、元記事へのリンクを設けてください。</p>

        <h2>お問い合わせ</h2>
        <p>当サイトへのお問い合わせ・記事に関するご意見は、<a href="${CONTACT_FORM_URL}" target="_blank" rel="noopener noreferrer">Googleフォームのお問い合わせ窓口</a>よりお送りください。</p>
        <p><a href="${CONTACT_FORM_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:0.75rem; background:var(--blue); color:#fff; padding:0.75rem 1.25rem; border-radius:6px; font-weight:700; text-decoration:none;">お問い合わせフォームを開く</a></p>

        <p style="margin-top:2rem; color: var(--text-muted); font-size:0.85rem;">
          &copy; ${CURRENT_YEAR} ${SITE_NAME}
        </p>
      </div>
    </main>
  </div>` +
    htmlFooter();
}

// ---- category page ----------------------------------------------------------

function buildCategoryPage(category, posts) {
  const label = categoryLabel(category);
  const catPosts = posts.filter((p) => (p.category || 'OTHER').toUpperCase() === category.toUpperCase());
  const recommendedBooks = buildRecommendedBooks(category.toUpperCase());

  const cards = catPosts.map((post) => {
    const slug = post.slug;
    const catLabel = categoryLabel(post.category);
    const catKey = (post.category || 'OTHER').toUpperCase();
    const date = formatDate(post.pubDate);
    const snippetText = post.bodyJa || post.postText || post.summary || '';
    const snip = excerpt(snippetText, 100);
    const ts3 = thumbStyle(catKey, '..');

    return `
      <article class="article-card">
        <div class="card-thumb" style="${ts3}">
          <div class="card-thumb-badge"><span class="badge">${escape(catLabel)}</span></div>
        </div>
        <div class="card-body">
          <h2 class="card-title">
            <a href="../posts/${escape(slug)}.html">${escape(post.titleJa || post.title)}</a>
          </h2>
          <p class="card-excerpt">${escape(snip)}</p>
          <div class="card-footer">
            <div class="card-meta-info">
              <span>${escape(post.source || '')}</span>
              <span class="card-meta-sep">·</span>
              <span>${escape(date)}</span>
            </div>
            <a class="read-more" href="../posts/${escape(slug)}.html">続きを読む →</a>
          </div>
        </div>
      </article>`;
  }).join('');

  const pageTitle = `${label}の記事一覧 | ${SITE_NAME}`;
  const pageDesc = `BIM・AEC・建設DXに関する${label}カテゴリの最新ニュース一覧です。`;
  const canonicalUrl = `${SITE_URL}/categories/${categorySlug(category)}.html`;

  const emptyMsg = catPosts.length === 0
    ? '<p style="color:var(--text-muted);padding:2rem 0;">このカテゴリの記事はまだありません。</p>'
    : '';

  const catKey2 = category.toUpperCase();
  const catImg2 = (THUMB_IMAGES[catKey2] || './assets/Getting-real-about-technology-part-1.webp').replace('./assets/', '../assets/');
  const catGrad2 = THUMB_GRADIENTS[catKey2] || 'linear-gradient(135deg, rgba(30,58,95,0.65) 0%, rgba(37,99,235,0.65) 100%)';
  const catHeroBg = `linear-gradient(135deg, rgba(10,22,40,0.80) 0%, rgba(10,22,40,0.72) 100%), ${catGrad2}, url('${catImg2}') center/cover no-repeat`;

  return htmlHead(pageTitle, pageDesc, canonicalUrl, '..') +
    htmlHeader('..') +
    `
  <div class="cat-hero" style="background: ${catHeroBg};">
    <div class="cat-hero-inner">
      <nav class="cat-hero-breadcrumb">
        <a href="../">ホーム</a> › <span>${escape(label)}</span>
      </nav>
      <h1 class="cat-hero-title">${escape(label)}</h1>
      <p class="cat-hero-count">${catPosts.length}件の記事</p>
    </div>
  </div>
  <div class="container">
    <div class="content-with-sidebar" style="padding: 2.5rem 0 4rem;">
      <main>
        ${emptyMsg}
        <div class="article-list">
          ${cards}
        </div>
      </main>
      ${recommendedBooks}${buildSidebar(posts, '..')}
    </div>
  </div>` +
    htmlFooter('..', catPosts.length);
}

// ---- events page ------------------------------------------------------------

function buildEventsPage(events) {
  const now = Date.now();

  // 今後 + 日付不明を「開催予定」、過去を「開催済み」に分類
  const upcoming = events.filter((ev) => {
    if (!ev.date) return true;
    const d = new Date(ev.date).getTime();
    return isNaN(d) || d >= now;
  });
  const past = events.filter((ev) => {
    if (!ev.date) return false;
    const d = new Date(ev.date).getTime();
    return !isNaN(d) && d < now;
  });

  function formatEventDate(ev) {
    if (!ev.date) return '日程未定';
    const d = new Date(ev.date);
    if (isNaN(d.getTime())) return '日程未定';
    const dateStr = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    if (ev.dateEnd) {
      const de = new Date(ev.dateEnd);
      if (!isNaN(de.getTime())) {
        return dateStr + ' 〜 ' + de.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
      }
    }
    return dateStr;
  }

  function eventCard(ev) {
    const dateLabel = formatEventDate(ev);
    const location  = escape(ev.location || '');
    const source    = escape(ev.source || '');
    const desc      = ev.description ? `<p class="event-desc">${escape(ev.description)}</p>` : '';
    return `
        <article class="event-card">
          <div class="event-meta">
            <span class="event-date">📅 ${escape(dateLabel)}</span>
            ${location ? `<span class="event-location">📍 ${location}</span>` : ''}
            <span class="event-source">${source}</span>
          </div>
          <h2 class="event-title">
            <a href="${escape(ev.url)}" target="_blank" rel="noopener noreferrer">${escape(ev.title)}</a>
          </h2>
          ${desc}
          <a class="event-link" href="${escape(ev.url)}" target="_blank" rel="noopener noreferrer">詳細・登録 →</a>
        </article>`;
  }

  const upcomingHtml = upcoming.length > 0
    ? upcoming.map(eventCard).join('')
    : '<p class="event-empty">現在、開催予定のイベント情報はありません。</p>';

  const pastHtml = past.length > 0
    ? past.map(eventCard).join('')
    : '';

  const pastSection = past.length > 0
    ? `<h2 class="events-section-title">開催済み</h2><div class="event-list past">${pastHtml}</div>`
    : '';

  const eventStyles = `
    .events-hero { background: var(--navy); color: var(--white); padding: 2.5rem 1.5rem; text-align: center; }
    .events-hero h1 { font-size: 1.75rem; font-weight: 700; }
    .events-hero p { opacity: 0.75; margin-top: 0.5rem; font-size: 0.95rem; }
    .events-main { max-width: 820px; margin: 2.5rem auto; padding: 0 1.5rem 4rem; }
    .events-section-title { font-size: 1.2rem; font-weight: 700; color: var(--navy); margin: 2.5rem 0 1rem; border-left: 4px solid var(--blue); padding-left: 0.75rem; }
    .event-list { display: flex; flex-direction: column; gap: 1.25rem; }
    .event-card { background: var(--white); border-radius: 10px; padding: 1.4rem 1.6rem; box-shadow: var(--card-shadow); border: 1px solid var(--border); }
    .event-list.past .event-card { opacity: 0.6; }
    .event-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.6rem; }
    .event-date { font-weight: 600; color: var(--blue); }
    .event-title { font-size: 1.05rem; font-weight: 700; line-height: 1.5; margin-bottom: 0.5rem; }
    .event-title a { color: var(--text); }
    .event-title a:hover { color: var(--blue); text-decoration: none; }
    .event-desc { font-size: 0.88rem; color: var(--text-muted); line-height: 1.65; margin-bottom: 0.75rem; }
    .event-link { font-size: 0.85rem; font-weight: 600; color: var(--blue); }
    .event-empty { color: var(--text-muted); font-size: 0.95rem; padding: 2rem 0; }`;

  return htmlHead(
    `イベント情報 | ${SITE_NAME}`,
    'BIM・AEC・建設DX関連の日本開催イベント・セミナー情報',
    `${SITE_URL}/events.html`
  ).replace('</style>', eventStyles + '\n  </style>') +
    htmlHeader('.') +
    `
  <div class="events-hero">
    <h1>イベント情報</h1>
    <p>BIM・AEC・建設DX関連の日本開催イベント・セミナー</p>
  </div>
  <div class="events-main">
    <h2 class="events-section-title">開催予定</h2>
    <div class="event-list">${upcomingHtml}</div>
    ${pastSection}
  </div>` +
    htmlFooter('.');
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

  // titleJaが空の記事（日本語化できなかった＝BIM無関係と判定済み）をサイト表示から除外
  const before = posts.length;
  posts = posts.filter((p) => p.titleJa && p.titleJa.trim() !== '');
  const excluded = before - posts.length;
  if (excluded > 0) {
    console.log(`[generateSite] titleJa未設定の記事を除外: ${excluded}件`);
  }

  // Assign slugs — respect pre-set slugs (e.g. weekly-YYYY-MM-DD)
  const usedSlugs = new Map();
  posts = posts.map((post) => {
    // If the post already has a valid slug, keep it
    if (post.slug && /^[a-z0-9-]+$/.test(post.slug)) {
      usedSlugs.set(post.slug, true);
      return post;
    }
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

  // Sort posts by pubDate descending (newest first)
  posts.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  // Ensure posts/ directory exists
  const postsDir = path.join(__dirname, 'posts');
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }
  const expectedPostFiles = new Set(posts.map((post) => `${post.slug}.html`));
  const existingPostFiles = fs.readdirSync(postsDir).filter((name) => name.endsWith('.html'));
  let removedPostCount = 0;
  for (const filename of existingPostFiles) {
    if (!expectedPostFiles.has(filename)) {
      fs.unlinkSync(path.join(postsDir, filename));
      removedPostCount++;
    }
  }
  if (removedPostCount > 0) {
    console.log(`[generateSite] Removed ${removedPostCount} stale article pages from posts/`);
  }

  // Generate index.html
  fs.writeFileSync(path.join(__dirname, 'index.html'), buildIndex(posts, posts.length), 'utf-8');
  console.log('[generateSite] Generated index.html');

  // Generate individual article pages
  let articleCount = 0;
  for (const post of posts) {
    const html = buildArticlePage(post, posts);
    fs.writeFileSync(path.join(postsDir, `${post.slug}.html`), html, 'utf-8');
    articleCount++;
  }
  console.log(`[generateSite] Generated ${articleCount} article pages in posts/`);

  // Generate category pages
  const categoriesDir = path.join(__dirname, 'categories');
  if (!fs.existsSync(categoriesDir)) {
    fs.mkdirSync(categoriesDir, { recursive: true });
  }
  const allCategories = [...new Set(posts.map((p) => (p.category || 'OTHER').toUpperCase()))];
  const expectedCategoryFiles = new Set(allCategories.map((cat) => `${categorySlug(cat)}.html`));
  const existingCategoryFiles = fs.readdirSync(categoriesDir).filter((name) => name.endsWith('.html'));
  let removedCategoryCount = 0;
  for (const filename of existingCategoryFiles) {
    if (!expectedCategoryFiles.has(filename)) {
      fs.unlinkSync(path.join(categoriesDir, filename));
      removedCategoryCount++;
    }
  }
  if (removedCategoryCount > 0) {
    console.log(`[generateSite] Removed ${removedCategoryCount} stale category pages from categories/`);
  }
  let categoryCount = 0;
  for (const cat of allCategories) {
    const slug = categorySlug(cat);
    const html = buildCategoryPage(cat, posts);
    fs.writeFileSync(path.join(categoriesDir, `${slug}.html`), html, 'utf-8');
    categoryCount++;
  }
  console.log(`[generateSite] Generated ${categoryCount} category pages in categories/`);

  // Generate static pages
  fs.writeFileSync(path.join(__dirname, 'privacy.html'), buildPrivacyPage(), 'utf-8');
  console.log('[generateSite] Generated privacy.html');

  fs.writeFileSync(path.join(__dirname, 'about.html'), buildAboutPage(), 'utf-8');
  console.log('[generateSite] Generated about.html');

  // Generate events.html
  const eventsFile = path.join(__dirname, 'data', 'events.json');
  let events = [];
  if (fs.existsSync(eventsFile)) {
    try { events = JSON.parse(fs.readFileSync(eventsFile, 'utf-8')); } catch { events = []; }
  }
  fs.writeFileSync(path.join(__dirname, 'events.html'), buildEventsPage(events), 'utf-8');
  console.log(`[generateSite] Generated events.html (${events.length}件)`);

  // Generate sitemap.xml
  const now = new Date().toISOString().split('T')[0];
  const categoryUrls = allCategories.map((cat) => ({
    loc: `${SITE_URL}/categories/${categorySlug(cat)}.html`,
    lastmod: now,
    changefreq: 'weekly',
    priority: '0.7',
  }));
  const staticUrls = [
    { loc: `${SITE_URL}/`, lastmod: now, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}/events.html`, lastmod: now, changefreq: 'weekly', priority: '0.8' },
    { loc: `${SITE_URL}/about.html`, lastmod: now, changefreq: 'monthly', priority: '0.5' },
    { loc: `${SITE_URL}/privacy.html`, lastmod: now, changefreq: 'monthly', priority: '0.3' },
    ...categoryUrls,
  ];
  const articleUrls = posts.map((post) => {
    const lastmod = post.pubDate
      ? new Date(post.pubDate).toISOString().split('T')[0]
      : now;
    return { loc: `${SITE_URL}/posts/${post.slug}.html`, lastmod, changefreq: 'monthly', priority: '0.8' };
  });
  const allUrls = [...staticUrls, ...articleUrls];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemapXml, 'utf-8');
  console.log(`[generateSite] Generated sitemap.xml (${allUrls.length} URLs)`);

  // Generate robots.txt
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /assets/
Crawl-delay: 10

Sitemap: ${SITE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(__dirname, 'robots.txt'), robotsTxt, 'utf-8');
  console.log('[generateSite] Generated robots.txt');

  console.log('[generateSite] Done.');
}

main();
