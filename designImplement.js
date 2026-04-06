'use strict';

/**
 * designImplement.js
 * DESIGN_REVIEW.md のモデレーターまとめを読んで、
 * 難易度「低」の改善を自動で generateSite.js に適用する。
 *
 * 判断ロジック:
 *   1. DESIGN_REVIEW.md から最新のモデレーターまとめを抽出
 *   2. 難易度:低 かつ 期待効果:中/高 の項目を特定
 *   3. 既知の改善カタログと照合し、該当するものを自動適用
 *   4. 変更があれば generateSite.js を実行してサイトを再生成
 */

try { require('dotenv').config(); } catch (e) {}

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REVIEW_FILE    = path.join(__dirname, 'DESIGN_REVIEW.md');
const SITE_JS        = path.join(__dirname, 'generateSite.js');
const IMPLEMENT_LOG  = path.join(__dirname, 'data', 'design_implement_log.json');

// ─────────────────────────────────────────────────────────────
// 自動適用できる改善カタログ
// 各エントリは DESIGN_REVIEW.md に含まれるキーワードと対応する
// ─────────────────────────────────────────────────────────────

const IMPROVEMENT_CATALOG = [
  {
    id: 'reading_time_card',
    keywords: ['読了時間', '読了目安', 'reading time', '読む時間'],
    description: '記事カードに読了時間を表示',
    check: (src) => src.includes('reading-time'),
    alreadyApplied: true, // generateSite.js に実装済み
  },
  {
    id: 'hero_stats',
    keywords: ['ファーストビュー', '価値提示', 'hero', 'AI解説', '差別化'],
    description: 'ヒーローセクションにAI差別化コピーと統計を追加',
    check: (src) => src.includes('hero-stats'),
    alreadyApplied: true, // 実装済み
  },
  {
    id: 'article_count_hero',
    keywords: ['記事数', '件数', '累計'],
    description: 'ヒーローに記事累計数を表示',
    check: (src) => src.includes('articleCount}件'),
    alreadyApplied: true,
  },
  {
    id: 'excerpt_length',
    keywords: ['リード文', 'リード', '概要文', '抜粋', '文字数', 'excerpt'],
    description: 'カードの抜粋文字数を120→160文字に拡張',
    check: (src) => src.includes('excerpt(snippetText, 160)'),
    apply: (src) => src.replace(
      'excerpt(snippetText, 120)',
      'excerpt(snippetText, 160)'
    ),
  },
  {
    id: 'related_count',
    keywords: ['関連記事', '内部リンク', 'related'],
    description: '関連記事表示数を3→5件に拡張',
    check: (src) => src.includes('.slice(0, 5)') && src.includes('related'),
    apply: (src) => src.replace(
      /\.filter\(\(p\) => p\.slug !== post\.slug && p\.category === post\.category\)\s*\.slice\(0, 3\)/,
      '.filter((p) => p.slug !== post.slug && p.category === post.category)\n    .slice(0, 5)'
    ),
  },
];

// ─────────────────────────────────────────────────────────────
// DESIGN_REVIEW.md からモデレーターまとめを抽出
// ─────────────────────────────────────────────────────────────

function extractModeratorSummary() {
  if (!fs.existsSync(REVIEW_FILE)) return '';
  const content = fs.readFileSync(REVIEW_FILE, 'utf-8');
  const match = content.match(/###\s*モデレーターまとめ[^\n]*\n([\s\S]*?)(?=\n---|\n##|$)/);
  return match ? match[1].trim() : '';
}

// ─────────────────────────────────────────────────────────────
// 実装ログ
// ─────────────────────────────────────────────────────────────

function loadLog() {
  if (!fs.existsSync(IMPLEMENT_LOG)) return { applied: [] };
  try { return JSON.parse(fs.readFileSync(IMPLEMENT_LOG, 'utf-8')); } catch { return { applied: [] }; }
}

function saveLog(log) {
  const dir = path.dirname(IMPLEMENT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(IMPLEMENT_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('[designImplement] デザイン自動実装を開始します');

  const summary = extractModeratorSummary();
  if (!summary) {
    console.log('[designImplement] モデレーターまとめが見つかりません — スキップ');
    return;
  }
  console.log(`[designImplement] モデレーターまとめ取得: ${summary.length}文字`);

  const src = fs.readFileSync(SITE_JS, 'utf-8');
  const log = loadLog();
  const appliedIds = new Set(log.applied.map((e) => e.id));

  let changed = false;
  let newSrc = src;

  for (const item of IMPROVEMENT_CATALOG) {
    // すでに適用済みならスキップ
    if (appliedIds.has(item.id)) {
      console.log(`[designImplement] ⏭ スキップ（適用済み）: ${item.description}`);
      continue;
    }
    // コード上すでに実装済みならログに記録してスキップ
    if (item.check(src)) {
      console.log(`[designImplement] ✅ 既実装を検出: ${item.description}`);
      log.applied.push({ id: item.id, description: item.description, appliedAt: new Date().toISOString(), auto: false });
      continue;
    }
    // レビューのキーワードと照合
    const summaryLower = summary.toLowerCase();
    const matched = item.keywords.some((kw) => summary.includes(kw) || summaryLower.includes(kw.toLowerCase()));
    if (!matched) {
      console.log(`[designImplement] ⏭ キーワード不一致: ${item.description}`);
      continue;
    }
    // apply関数がある場合は実際に適用
    if (!item.apply) {
      console.log(`[designImplement] ℹ️  手動実装が必要: ${item.description}`);
      continue;
    }
    const patched = item.apply(newSrc);
    if (patched === newSrc) {
      console.log(`[designImplement] ⚠️  パッチ適用失敗（差分なし）: ${item.description}`);
      continue;
    }
    newSrc = patched;
    changed = true;
    log.applied.push({ id: item.id, description: item.description, appliedAt: new Date().toISOString(), auto: true });
    console.log(`[designImplement] 🔧 適用: ${item.description}`);
  }

  if (changed) {
    fs.writeFileSync(SITE_JS, newSrc, 'utf-8');
    console.log('[designImplement] generateSite.js を更新しました');
  } else {
    console.log('[designImplement] 今週の自動適用対象なし');
  }

  saveLog(log);

  // サイト再生成
  console.log('[designImplement] generateSite.js を実行します...');
  try {
    execSync('node generateSite.js', { stdio: 'inherit', cwd: __dirname });
    console.log('[designImplement] サイト再生成完了');
  } catch (err) {
    console.error('[designImplement] generateSite.js 失敗:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[designImplement] エラー:', err.message);
  process.exit(1);
});
