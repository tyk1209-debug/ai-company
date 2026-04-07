/**
 * affiliateLinks.js
 * カテゴリに応じたアフィリエイト商品リンクをX投稿文に自動付加する
 *
 * URLはすべてプレースホルダ（実際のアフィリエイトIDは後で設定）
 */

// ─────────────────────────────────────────────────────────────
// カテゴリ別アフィリエイト商品定義
// ─────────────────────────────────────────────────────────────

const AFFILIATE_PRODUCTS = {
  REVIT: [
    { name: "Revit公式入門書", url: "https://amzn.to/revit-book", type: "amazon" },
    { name: "Autodesk公式 Revitコース", url: "https://px.a8.net/revit-udemy", type: "udemy" },
  ],
  ARCHICAD: [
    { name: "Archicad基礎マスター", url: "https://px.a8.net/archicad-udemy", type: "udemy" },
  ],
  IFC: [
    { name: "BIM実務ハンドブック", url: "https://amzn.to/bim-book", type: "amazon" },
    { name: "buildingSMART公認BIM入門", url: "https://amzn.to/bim-smartbook", type: "amazon" },
  ],
  BIM_ECOSYSTEM: [
    { name: "BIM実務ハンドブック", url: "https://amzn.to/bim-book", type: "amazon" },
    { name: "buildingSMART公認BIM入門", url: "https://amzn.to/bim-smartbook", type: "amazon" },
  ],
  BIM_AI: [
    { name: "BIM実務ハンドブック", url: "https://amzn.to/bim-book", type: "amazon" },
    { name: "buildingSMART公認BIM入門", url: "https://amzn.to/bim-smartbook", type: "amazon" },
  ],
  AI_DX: [
    { name: "建設DX入門", url: "https://amzn.to/dx-book", type: "amazon" },
    { name: "生成AI × 建設業", url: "https://px.a8.net/ai-kensetsu", type: "udemy" },
  ],
  OTHER: [
    { name: "BIM/CIM実践ガイド", url: "https://amzn.to/bimcim-book", type: "amazon" },
  ],
  GLOOBE: [
    { name: "BIM/CIM実践ガイド", url: "https://amzn.to/bimcim-book", type: "amazon" },
  ],
};

// ─────────────────────────────────────────────────────────────
// 関数
// ─────────────────────────────────────────────────────────────

/**
 * カテゴリに対応するアフィリエイト商品1件を返す（ランダム選択）
 * @param {string} category
 * @returns {{ name: string, url: string, type: "amazon"|"udemy" } | null}
 */
function getAffiliateLink(category) {
  const products = AFFILIATE_PRODUCTS[category];
  if (!products || products.length === 0) {
    return null;
  }
  return products[Math.floor(Math.random() * products.length)];
}

/**
 * 投稿文にアフィリエイトリンクを追加する
 * postText が 120字以上の場合はリンクを付けない（140字超過防止）
 * @param {string} postText
 * @param {string} category
 * @returns {string}
 */
function appendAffiliateLink(postText, category) {
  if (!postText || postText.length >= 120) {
    return postText;
  }

  const product = getAffiliateLink(category);
  if (!product) {
    return postText;
  }

  const suffix = `\n📚 関連: ${product.name} → ${product.url}`;

  if (postText.length + suffix.length > 140) {
    return postText;
  }

  return postText + suffix;
}

/**
 * 記事配列に対してアフィリエイトリンクを付加する
 * 各記事の postText を appendAffiliateLink で更新した新しい配列を返す
 * @param {object[]} articles
 * @returns {object[]}
 */
function applyAffiliateLinks(articles) {
  return articles.map((article) => ({
    ...article,
    postText: appendAffiliateLink(article.postText, article.category),
  }));
}

// ─────────────────────────────────────────────────────────────
// ウェブサイト記事ページ用アフィリエイトリンク
// ─────────────────────────────────────────────────────────────

/**
 * BIM/AEC関連のAmazonアソシエイトリンク定義
 * TODO: 実際のアソシエイトタグに差し替える（現在はプレースホルダー）
 * アソシエイトタグ形式: ?tag=YOUR-ASSOCIATE-TAG-22
 */
const AFFILIATE_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'aecnewsjapan-22';

const SITE_AFFILIATE_LINKS = [
  {
    keywords: ['Revit', 'revit', 'ファミリ', 'オートデスク'],
    title: 'はじめてのAutodesk Revit＆Revit LT [Revit/Revit LT 2026対応]',
    description: 'Revitの基本操作や考え方を体系的に押さえたい読者向けの入門書です。',
    url: 'https://amzn.to/3QpB1Ja',
    category: 'REVIT',
  },
  {
    keywords: ['Archicad', 'アーキキャド', 'Graphisoft'],
    title: 'Archicad28ではじめるBIM設計入門[基本・実施設計編]',
    description: 'ArchicadでBIM設計を始めたい読者向けの実務入門書です。',
    url: 'https://amzn.to/4tCIdjL',
    category: 'BIM_ECOSYSTEM',
  },
  {
    keywords: ['GLOOBE', '福井コンピュータ'],
    title: 'GLOOBE ArchitectではじめるBIM活用入門',
    description: 'GLOOBEを使ったBIM活用の流れをつかみたい読者向けの一冊です。',
    url: 'https://amzn.to/3PQRhD2',
    category: 'GLOOBE',
  },
  {
    keywords: ['ドローン', 'レーザ測量', '点群', '測量'],
    title: '基本から学ぶ 測量技術者のための ドローンによる写真測量とレーザ測量',
    description: '現場計測や3Dデータ取得の基礎を学びたい読者向けの書籍です。',
    url: 'https://amzn.to/4veruET',
    category: 'BIM_ECOSYSTEM',
  },
  {
    keywords: ['ファシリティマネジメント', 'FM', '維持管理'],
    title: 'ファシリティマネジメントのためのBIM要件定義',
    description: 'BIMの運用段階やFM視点の要件整理を深めたい読者向けです。',
    url: 'https://amzn.to/4cg9ZLX',
    category: 'BIM_ECOSYSTEM',
  },
  {
    keywords: ['建設DX', 'AI', 'DX', 'ゼネコン', '業務改革'],
    title: 'ゼネコン5.0: SDGs、DX時代の建設業の経営戦略',
    description: '建設業のDXや経営変革を俯瞰したい読者向けの書籍です。',
    url: 'https://amzn.to/4tAYxl5',
    category: 'AI_DX',
  },
];

/**
 * 記事のタイトル・本文に応じたアフィリエイトリンクを返す（記事ページ用）
 * @param {object} post
 * @returns {Array<{ title: string, url: string }>}
 */
function getAffiliateLinks(post) {
  const text = `${post.title || ''} ${post.titleJa || ''} ${post.postText || ''} ${post.bodyJa || ''}`;
  const matched = SITE_AFFILIATE_LINKS.filter(link =>
    link.keywords.some(kw => text.includes(kw))
  );
  if (matched.length > 0) {
    return matched.slice(0, 2);
  }

  const category = (post.category || 'OTHER').toUpperCase();
  const categoryMatches = SITE_AFFILIATE_LINKS.filter(link => link.category === category);
  return categoryMatches.slice(0, 2);
}

module.exports = { getAffiliateLink, appendAffiliateLink, applyAffiliateLinks, getAffiliateLinks };
