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
    keywords: ['Revit', 'revit', 'オートデスク'],
    title: 'Autodesk Revit公式ガイド',
    url: `https://www.amazon.co.jp/s?k=Revit+BIM&tag=${AFFILIATE_TAG}`,
    category: 'REVIT',
  },
  {
    keywords: ['ArchiCAD', 'アーキキャド', 'Graphisoft'],
    title: 'ArchiCAD完全ガイド',
    url: `https://www.amazon.co.jp/s?k=ArchiCAD&tag=${AFFILIATE_TAG}`,
    category: 'BIM_ECOSYSTEM',
  },
  {
    keywords: ['BIM', 'ビム', '建設DX', 'デジタルツイン'],
    title: 'BIM導入・活用ガイド',
    url: `https://www.amazon.co.jp/s?k=BIM+建築+設計&tag=${AFFILIATE_TAG}`,
    category: 'BIM_ECOSYSTEM',
  },
  {
    keywords: ['IFC', '建築情報', 'データ連携'],
    title: 'BIM/IFC関連書籍',
    url: `https://www.amazon.co.jp/s?k=BIM+IFC+建築&tag=${AFFILIATE_TAG}`,
    category: 'IFC',
  },
  {
    keywords: ['Vectorworks', 'ベクターワークス'],
    title: 'Vectorworks実践ガイド',
    url: `https://www.amazon.co.jp/s?k=Vectorworks&tag=${AFFILIATE_TAG}`,
    category: 'BIM_ECOSYSTEM',
  },
];

/**
 * 記事のタイトル・本文に応じたアフィリエイトリンクを返す（記事ページ用）
 * @param {object} post
 * @returns {Array<{ title: string, url: string }>}
 */
function getAffiliateLinks(post) {
  const text = `${post.title || ''} ${post.titleJa || ''} ${post.postText || ''}`;
  const matched = SITE_AFFILIATE_LINKS.filter(link =>
    link.keywords.some(kw => text.includes(kw))
  );
  // マッチしなければデフォルト（BIM全般）
  return matched.length > 0 ? matched.slice(0, 2) : [SITE_AFFILIATE_LINKS[2]];
}

module.exports = { getAffiliateLink, appendAffiliateLink, applyAffiliateLinks, getAffiliateLinks };
