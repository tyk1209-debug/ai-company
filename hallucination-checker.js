/**
 * hallucination-checker.js
 * BIM/AEC特化ハルシネーション検証モジュール
 *
 * AI要約文が元記事の内容と一致しているかを検証し、
 * リスクスコア (LOW / MEDIUM / HIGH) を付与する。
 *
 * 使い方:
 *   const { checkHallucination, checkArticles } = require("./hallucination-checker.js");
 */

const Anthropic = require("@anthropic-ai/sdk");

function createClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// ─────────────────────────────────────────────────────────────
// BIM/AEC ドメイン固有の危険パターン
// ─────────────────────────────────────────────────────────────

// 断言表現（「〜に対応」「〜が可能」「〜を廃止」など）
const ASSERTION_PATTERNS = [
  /に対応(しました|済み|)/,
  /が可能(になりました|です|)/,
  /を(廃止|削除|サポート終了)/,
  /バージョン\s*[\d.]+/,
  /v\s*[\d.]+/,
  /IFC\s*[\d.x]+/,
  /ISO\s*\d+/,
  /建基法/,
  /\d{4}年\d{1,2}月/,  // 具体的な日付
  /無償|有償|無料|有料/,
  /買収|合併|統合|廃業/,
];

// ─────────────────────────────────────────────────────────────
// 静的パターンチェック（API不使用・高速）
// ─────────────────────────────────────────────────────────────

function staticRiskCheck(summary) {
  const flags = [];

  for (const pattern of ASSERTION_PATTERNS) {
    const match = summary.match(pattern);
    if (match) {
      flags.push(match[0]);
    }
  }

  return flags;
}

// ─────────────────────────────────────────────────────────────
// Claude APIによる深い検証
// ─────────────────────────────────────────────────────────────

async function deepCheck(article) {
  const client = createClient();
  const prompt = `あなたはBIM/AEC業界の専門家です。以下の記事タイトルと日本語要約を照合し、ハルシネーション（事実と異なる記述）のリスクを評価してください。

## 記事情報
タイトル: ${article.title}
URL: ${article.link}
元記事の概要（英語）: ${article.summary || "（概要なし）"}

## AI生成の日本語要約
${article.japaneseSummary || "（要約なし）"}

## 評価してください
以下のJSON形式で回答してください（他のテキストは不要）:
{
  "score": "LOW" | "MEDIUM" | "HIGH",
  "flags": ["問題のある記述1", "問題のある記述2"],
  "reason": "判定理由を1文で"
}

判定基準:
- LOW: 要約が元記事の内容と一致、または検証不能だが重大な断言なし
- MEDIUM: 軽微な誇張・ニュアンスのズレがある
- HIGH: 元記事にない事実・数値・バージョン情報・法規の断言が含まれる`;

  if (!client) {
    return { score: "LOW", flags: [], reason: "ANTHROPIC_API_KEY 未設定 — スキップ" };
  }

  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { score: "LOW", flags: [], reason: "解析不能 — 安全側に倒す" };
    }

    return JSON.parse(jsonMatch[0]);
  } catch {
    return { score: "LOW", flags: [], reason: "API呼び出し失敗 — スキップ" };
  }
}

// ─────────────────────────────────────────────────────────────
// メイン検証関数
// ─────────────────────────────────────────────────────────────

/**
 * 1件の記事のハルシネーションリスクを評価する
 * @param {object} article
 * @returns {Promise<{ score: string, flags: string[], reason: string }>}
 */
async function checkHallucination(article) {
  // 要約がない場合は検証不要
  if (!article.japaneseSummary) {
    return { score: "LOW", flags: [], reason: "要約なし — スキップ" };
  }

  // STEP 1: 静的パターンチェック（高速）
  const staticFlags = staticRiskCheck(article.japaneseSummary);

  // 断言表現が3つ以上ある場合はAPIで深く検証
  if (staticFlags.length >= 3 || process.env.ANTHROPIC_API_KEY) {
    const deepResult = await deepCheck(article);
    return {
      ...deepResult,
      flags: [...new Set([...staticFlags, ...deepResult.flags])],
    };
  }

  // 断言表現が少ない場合は静的チェックのみ
  const score = staticFlags.length === 0 ? "LOW" : "MEDIUM";
  return {
    score,
    flags:  staticFlags,
    reason: staticFlags.length > 0 ? `断言表現を検出: ${staticFlags.join(", ")}` : "問題なし",
  };
}

/**
 * 複数記事を検証して hallucinationRisk フィールドを付与する
 * HIGH リスクの記事は自動除外し、除外された記事のリストも返す
 * @param {object[]} articles
 * @returns {Promise<{ passed: object[], blocked: object[] }>}
 */
async function checkArticles(articles) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[HallucinationChecker] ANTHROPIC_API_KEY 未設定 — 静的チェックのみ");
  }

  const passed  = [];
  const blocked = [];

  for (const article of articles) {
    const risk = await checkHallucination(article);
    const enriched = { ...article, hallucinationRisk: risk };

    if (risk.score === "HIGH") {
      console.log(`[HallucinationChecker] ❌ HIGH リスク → ブロック: ${article.title?.slice(0, 50)}`);
      console.log(`   理由: ${risk.reason}`);
      blocked.push(enriched);
    } else {
      if (risk.score === "MEDIUM") {
        console.log(`[HallucinationChecker] ⚠️  MEDIUM リスク → Telegramで要確認: ${article.title?.slice(0, 50)}`);
      }
      passed.push(enriched);
    }

    // API レート制限対策
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[HallucinationChecker] 通過: ${passed.length}件 / ブロック: ${blocked.length}件`);
  return { passed, blocked };
}

// ─────────────────────────────────────────────────────────────
// エクスポート
// ─────────────────────────────────────────────────────────────

module.exports = { checkHallucination, checkArticles };
