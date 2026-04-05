'use strict';

/**
 * designReview.js
 * 週1回、4つの専門家ペルソナがサイトのHTMLを読んで改善案を議論し、
 * 結果を DESIGN_REVIEW.md に保存するスクリプト。
 *
 * 外部参照: 競合サイトや最新デザインブログを実際にフェッチし、
 * 「AEC News Japan の相対的な立ち位置」まで評価する。
 */

try { require('dotenv').config(); } catch (e) {}

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { fetchArticleText } = require('./fetchArticle.js');

// ---- constants ---------------------------------------------------------------

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;
const HTML_CHAR_LIMIT = 3000;
const REF_CHAR_LIMIT = 1500; // 参照サイトは1件あたり1500文字まで
const MAX_REVIEW_SECTIONS = 5;
const REVIEW_FILE = path.join(__dirname, 'DESIGN_REVIEW.md');
const INDEX_HTML = path.join(__dirname, 'index.html');

// ---- 参照サイト定義 -----------------------------------------------------------
// BIM/AEC専門メディアやWebデザイントレンドブログ
const REFERENCE_SITES = [
  { label: 'AEC Magazine（競合・英語メディア）', url: 'https://www.aecmag.com/' },
  { label: 'Construction Dive（競合・英語メディア）', url: 'https://www.constructiondive.com/' },
  { label: 'Smashing Magazine（Webデザイントレンド）', url: 'https://www.smashingmagazine.com/articles/' },
];

// ---- persona definitions -----------------------------------------------------

const PERSONAS = [
  {
    id: 'ux',
    label: 'UXデザイナーの評価',
    system: `あなたはWebサイトのUXデザイナーです。
BIM・AEC専門ニュースサイト「AEC News Japan」のHTMLを見て、
訪問者が記事にたどり着くまでの導線・読みやすさ・視覚的な引きつけ方について
具体的な改善点を3点、箇条書きで指摘してください。
良い点も1点挙げてください。日本語で答えてください。`,
  },
  {
    id: 'seo',
    label: 'SEOエンジニアの評価',
    system: `あなたはWebサイトのSEOエンジニアです。
BIM・AEC専門ニュースサイト「AEC News Japan」のHTMLを見て、
見出し構造・内部リンク・メタ情報の充実度・クリックを誘うタイトルについて
具体的な改善点を3点、箇条書きで指摘してください。
良い点も1点挙げてください。日本語で答えてください。`,
  },
  {
    id: 'content',
    label: 'コンテンツストラテジストの評価',
    system: `あなたはWebサイトのコンテンツストラテジストです。
BIM・AEC専門ニュースサイト「AEC News Japan」のHTMLを見て、
読者が次の行動を取りたくなる構成・信頼感の演出・CTAの効果について
具体的な改善点を3点、箇条書きで指摘してください。
良い点も1点挙げてください。日本語で答えてください。`,
  },
  {
    id: 'mobile',
    label: 'モバイルエキスパートの評価',
    system: `あなたはモバイルWebのエキスパートです。
BIM・AEC専門ニュースサイト「AEC News Japan」のHTMLを見て、
スマホでの読みやすさ・タップ領域の適切さ・表示速度への影響について
具体的な改善点を3点、箇条書きで指摘してください。
良い点も1点挙げてください。日本語で答えてください。`,
  },
];

const MODERATOR_SYSTEM = `あなたはWebサイト改善のモデレーターです。
4人の専門家（UXデザイナー、SEOエンジニア、コンテンツストラテジスト、モバイルエキスパート）の
評価を統合し、最も重要な改善提案を優先度順に3〜5点にまとめてください。
各提案には「難易度：低/中/高」と「期待効果：低/中/高」を付けてください。
日本語で答えてください。`;

// ---- helpers -----------------------------------------------------------------

function today() {
  return new Date().toISOString().split('T')[0];
}

function loadHtml() {
  if (!fs.existsSync(INDEX_HTML)) {
    throw new Error(`index.html not found: ${INDEX_HTML}`);
  }
  const content = fs.readFileSync(INDEX_HTML, 'utf-8');
  return content.slice(0, HTML_CHAR_LIMIT);
}

/**
 * 参照サイトを実際にフェッチしてテキストを取得する
 * 失敗しても処理を止めない（ベストエフォート）
 */
async function fetchReferences() {
  const results = [];
  for (const site of REFERENCE_SITES) {
    try {
      console.log(`  参照フェッチ: ${site.label}`);
      const text = await fetchArticleText(site.url);
      if (text && text.length > 100) {
        results.push({
          label: site.label,
          url: site.url,
          excerpt: text.slice(0, REF_CHAR_LIMIT),
        });
      }
    } catch (err) {
      console.warn(`  参照フェッチ失敗（スキップ）: ${site.label} — ${err.message}`);
    }
  }
  return results;
}

/**
 * 参照サイト情報をプロンプト用テキストに整形する
 */
function buildReferenceContext(refs) {
  if (refs.length === 0) return '';
  const lines = ['', '【参考：他メディアの構成・コンテンツ】'];
  for (const r of refs) {
    lines.push(`\n■ ${r.label}（${r.url}）`);
    lines.push(r.excerpt);
  }
  return lines.join('\n');
}

async function callPersona(client, persona, htmlSnippet, referenceContext) {
  const userContent = [
    `以下はAEC News Japan（aec-news.com）のトップページHTMLです。評価をお願いします。`,
    `\n\`\`\`html\n${htmlSnippet}\n\`\`\``,
    referenceContext,
    `\n上記の参考情報も踏まえて、AEC News Japanの改善点を具体的に指摘してください。`,
  ].join('\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: persona.system,
    messages: [{ role: 'user', content: userContent }],
  });
  const block = response.content.find((b) => b.type === 'text');
  return block ? block.text.trim() : '(レスポンスなし)';
}

async function callModerator(client, personaResults, refs) {
  const summary = personaResults
    .map((r) => `## ${r.label}\n${r.text}`)
    .join('\n\n');

  const refNote = refs.length > 0
    ? `\n\n参照した外部サイト: ${refs.map((r) => r.label).join('、')}`
    : '';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: MODERATOR_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `4人の専門家の評価は以下の通りです。${refNote}\n\n${summary}\n\n優先度順に統合まとめをお願いします。`,
      },
    ],
  });
  const block = response.content.find((b) => b.type === 'text');
  return block ? block.text.trim() : '(レスポンスなし)';
}

// ---- review record builders --------------------------------------------------

function buildReviewSection(date, personaResults, moderatorText, refs) {
  const lines = [`## ${date} 週次デザインレビュー`, ''];

  if (refs.length > 0) {
    lines.push(`> 参照サイト: ${refs.map((r) => `[${r.label}](${r.url})`).join(' / ')}`);
    lines.push('');
  }

  for (const result of personaResults) {
    lines.push(`### ${result.label}`);
    lines.push(result.text);
    lines.push('');
  }

  lines.push('### モデレーターまとめ（優先度順）');
  lines.push(moderatorText);
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

function trimOldReviews(content) {
  // セクション（## で始まる行）を数えて MAX_REVIEW_SECTIONS 件を超えたら末尾を削除
  const sectionPattern = /^## /m;
  const parts = content.split(/(?=^## )/m);

  // 先頭の空白部分は保持しつつセクション数を制限
  const sections = parts.filter((p) => sectionPattern.test(p));
  if (sections.length <= MAX_REVIEW_SECTIONS) {
    return content;
  }

  return sections.slice(0, MAX_REVIEW_SECTIONS).join('');
}

function prependToReviewFile(newSection) {
  let existing = '';
  if (fs.existsSync(REVIEW_FILE)) {
    existing = fs.readFileSync(REVIEW_FILE, 'utf-8');
  }

  const combined = newSection + existing;
  const trimmed = trimOldReviews(combined);
  fs.writeFileSync(REVIEW_FILE, trimmed, 'utf-8');
}

// ---- main --------------------------------------------------------------------

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('APIキーが設定されていないためレビューをスキップします');
    process.exit(0);
  }

  const client = new Anthropic({ apiKey });
  const htmlSnippet = loadHtml();
  const date = today();

  console.log(`デザインレビュー開始: ${date}`);
  console.log(`HTMLスニペット: ${htmlSnippet.length}文字`);

  // 競合・参照サイトをフェッチ
  console.log('参照サイトをフェッチ中...');
  const refs = await fetchReferences();
  console.log(`参照サイト取得: ${refs.length}件`);
  const referenceContext = buildReferenceContext(refs);

  // 4ペルソナを順番に評価
  const personaResults = [];
  for (const persona of PERSONAS) {
    console.log(`  ${persona.label} を評価中...`);
    const text = await callPersona(client, persona, htmlSnippet, referenceContext);
    personaResults.push({ label: persona.label, text });
  }

  // モデレーターまとめ
  console.log('  モデレーターまとめを生成中...');
  const moderatorText = await callModerator(client, personaResults, refs);

  // DESIGN_REVIEW.md に追記
  const section = buildReviewSection(date, personaResults, moderatorText, refs);
  prependToReviewFile(section);

  console.log(`デザインレビュー完了: ${REVIEW_FILE}`);
}

main().catch((err) => {
  console.error('designReview.js エラー:', err.message);
  process.exit(1);
});
