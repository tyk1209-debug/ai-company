/**
 * affiliateLinks.js
 * 記事文脈に応じたアフィリエイトリンクを返す
 */

// X投稿用の旧ロジックも残すが、記事ページ側の選定が主用途。

const AFFILIATE_PRODUCTS = {
  REVIT: [
    { name: 'Revit公式入門書', url: 'https://amzn.to/revit-book', type: 'amazon' },
    { name: 'Autodesk公式 Revitコース', url: 'https://px.a8.net/revit-udemy', type: 'udemy' },
  ],
  ARCHICAD: [
    { name: 'Archicad基礎マスター', url: 'https://px.a8.net/archicad-udemy', type: 'udemy' },
  ],
  IFC: [
    { name: 'BIM実務ハンドブック', url: 'https://amzn.to/bim-book', type: 'amazon' },
    { name: 'buildingSMART公認BIM入門', url: 'https://amzn.to/bim-smartbook', type: 'amazon' },
  ],
  BIM_ECOSYSTEM: [
    { name: 'BIM実務ハンドブック', url: 'https://amzn.to/bim-book', type: 'amazon' },
    { name: 'buildingSMART公認BIM入門', url: 'https://amzn.to/bim-smartbook', type: 'amazon' },
  ],
  BIM_AI: [
    { name: 'BIM実務ハンドブック', url: 'https://amzn.to/bim-book', type: 'amazon' },
    { name: 'buildingSMART公認BIM入門', url: 'https://amzn.to/bim-smartbook', type: 'amazon' },
  ],
  AI_DX: [
    { name: '建設DX入門', url: 'https://amzn.to/dx-book', type: 'amazon' },
    { name: '生成AI × 建設業', url: 'https://px.a8.net/ai-kensetsu', type: 'udemy' },
  ],
  OTHER: [
    { name: 'BIM/CIM実践ガイド', url: 'https://amzn.to/bimcim-book', type: 'amazon' },
  ],
  GLOOBE: [
    { name: 'BIM/CIM実践ガイド', url: 'https://amzn.to/bimcim-book', type: 'amazon' },
  ],
};

function getAffiliateLink(category) {
  const products = AFFILIATE_PRODUCTS[category];
  if (!products || products.length === 0) return null;
  return products[Math.floor(Math.random() * products.length)];
}

function appendAffiliateLink(postText, category) {
  if (!postText || postText.length >= 120) return postText;
  const product = getAffiliateLink(category);
  if (!product) return postText;
  const suffix = `\n📚 関連: ${product.name} → ${product.url}`;
  if (postText.length + suffix.length > 140) return postText;
  return postText + suffix;
}

function applyAffiliateLinks(articles) {
  return articles.map((article) => ({
    ...article,
    postText: appendAffiliateLink(article.postText, article.category),
  }));
}

const SITE_AFFILIATE_LINKS = [
  {
    id: 'revit-book',
    family: 'book-revit',
    category: 'REVIT',
    title: 'はじめてのAutodesk Revit＆Revit LT [Revit/Revit LT 2026対応]',
    description: 'Revitの操作だけでなく、BIMオブジェクトやファミリの考え方まで整理したい読者向けの入門書です。',
    url: 'https://amzn.to/3QpB1Ja',
    keywords: ['Revit', 'revit', 'ファミリ', 'オートデスク', 'Autodesk'],
    signals: ['revit', 'bim-modeling', 'software'],
  },
  {
    id: 'archicad-book',
    family: 'book-archicad',
    category: 'BIM_ECOSYSTEM',
    title: 'Archicad28ではじめるBIM設計入門[基本・実施設計編]',
    description: 'Archicadの特徴とBIM設計フローをまとめて把握したい読者向けの実務入門書です。',
    url: 'https://amzn.to/4tCIdjL',
    keywords: ['Archicad', 'アーキキャド', 'Graphisoft', 'Bluebeam'],
    signals: ['archicad', 'openbim', 'software'],
  },
  {
    id: 'gloobe-book',
    family: 'book-gloobe',
    category: 'GLOOBE',
    title: 'GLOOBE ArchitectではじめるBIM活用入門',
    description: 'GLOOBEを軸に、日本の設計実務でBIMをどう運用するかを整理したい読者向けです。',
    url: 'https://amzn.to/3PQRhD2',
    keywords: ['GLOOBE', '福井コンピュータ'],
    signals: ['gloobe', 'software', 'bim-modeling'],
  },
  {
    id: 'survey-book',
    family: 'book-capture',
    category: 'BIM_ECOSYSTEM',
    title: '基本から学ぶ 測量技術者のための ドローンによる写真測量とレーザ測量',
    description: '点群、ドローン、レーザ測量、現況取得の基礎を押さえたい読者向けの実務書です。',
    url: 'https://amzn.to/4veruET',
    keywords: ['ドローン', 'レーザ測量', '点群', '測量', 'LiDAR', 'スキャン', 'scan', 'reality capture', '遺産', '現況'],
    signals: ['capture', 'survey'],
  },
  {
    id: 'fm-book',
    family: 'book-governance',
    category: 'BIM_ECOSYSTEM',
    title: 'ファシリティマネジメントのためのBIM要件定義',
    description: 'BIMデータの要件定義、受け渡し、運用ルールまで含めて整理したい読者向けの一冊です。',
    url: 'https://amzn.to/4cg9ZLX',
    keywords: ['ファシリティマネジメント', 'FM', '維持管理', 'IFC', 'openBIM', 'CDE', 'Construction Cloud', 'ACC', 'Autodesk Construction Cloud', 'Bluebeam', 'Revizto', 'LCA', '埋蔵炭素', 'エンボディドカーボン', '炭素', '要件定義'],
    signals: ['governance', 'openbim', 'integration', 'sustainability'],
  },
  {
    id: 'dx-book',
    family: 'book-dx',
    category: 'AI_DX',
    title: 'ゼネコン5.0: SDGs、DX時代の建設業の経営戦略',
    description: '建設DX、AI導入、事業変革を経営と現場の両面から捉えたい読者向けの書籍です。',
    url: 'https://amzn.to/4tAYxl5',
    keywords: ['建設DX', 'DX', 'ゼネコン', '業務改革', 'M&A', '統合', '買収', '投資', 'プラットフォーム', 'AIエージェント', 'agent', 'ワークフロー', '契約分析', 'Document Crunch', 'Datagrid', 'CMap', 'Procore', 'Trimble'],
    signals: ['strategy', 'ai', 'dx', 'business'],
  },
  {
    id: 'desktop-13700f',
    family: 'hardware-desktop',
    category: 'OTHER',
    title: 'Core i7 13700F / RTX4070 / メモリ32GB / SSD 1TB デスクトップPC',
    description: 'BIMモデル、レンダリング、軽めのAI検証を1台で進めたいときの現実的な構成候補です。',
    url: 'https://amzn.to/4cfUpjf',
    keywords: ['ワークステーション', 'workstation', 'デスクトップ', 'desktop', 'RTX4070', 'RTX 4070', 'Core i7', 'BTO'],
    signals: ['hardware', 'desktop', 'gpu'],
  },
  {
    id: 'desktop-12700f',
    family: 'hardware-desktop-alt',
    category: 'OTHER',
    title: '第12世代 Core i7 12700F / RTX4070 / メモリ32GB / SSD 1TB デスクトップPC',
    description: 'BIMや可視化用途でコストと性能のバランスを見たい読者向けのデスクトップ候補です。',
    url: 'https://amzn.to/41QMXWS',
    keywords: ['ワークステーション', 'workstation', '第12世代', '12700F', 'RTX4070', 'RTX 4070', 'デスクトップ'],
    signals: ['hardware', 'desktop', 'gpu'],
  },
  {
    id: 'desktop-cobratype',
    family: 'hardware-desktop-alt',
    category: 'OTHER',
    title: 'Cobratype Elevate (Intel i7-13700KF | RTX 4070)',
    description: 'GPUを重視したBIM・可視化・AI向けの作業環境を比較したいときの候補です。',
    url: 'https://amzn.to/4dyLQ5o',
    keywords: ['Cobratype', '13700KF', 'RTX4070', 'RTX 4070', 'ゲーミングPC', 'デスクトップ'],
    signals: ['hardware', 'desktop', 'gpu'],
  },
  {
    id: 'rtx4090',
    family: 'hardware-gpu',
    category: 'OTHER',
    title: 'NVIDIA GeForce RTX 4090 24GB Founders Edition',
    description: 'VRAM容量が重要なレンダリング、ビジュアライゼーション、生成AI用途を強く意識する方向けのGPUです。',
    url: 'https://amzn.to/4bV2GKz',
    keywords: ['RTX4090', 'RTX 4090', 'GeForce RTX 4090', 'GPU', 'VRAM', 'GPUメモリ', '可視化', 'レンダリング', 'viz', 'Redshift', '3D'],
    signals: ['hardware', 'gpu', 'visualization', 'ai'],
  },
  {
    id: 'ultrawide-gaming',
    family: 'hardware-monitor',
    category: 'OTHER',
    title: '34インチ 曲面ウルトラワイドモニター UWQHD 3440x1440',
    description: '図面、BIMモデル、レビュー資料を横並びで確認したい読者向けの表示環境候補です。',
    url: 'https://amzn.to/4sZAJaD',
    keywords: ['ウルトラワイド', 'ultrawide', 'モニター', 'monitor', '3440x1440', 'UWQHD', 'CAD', '図面', '可視化', 'レビュー'],
    signals: ['hardware', 'monitor', 'workspace'],
  },
  {
    id: 'ultrawide-lg',
    family: 'hardware-monitor',
    category: 'AI_DX',
    title: 'LG ウルトラワイドモニター 34WR50QK-B 34インチ / 3440×1440',
    description: 'BIM、表計算、ブラウザ、会議資料を同時に開いて進めたい実務向けのモニター候補です。',
    url: 'https://amzn.to/4twaMPC',
    keywords: ['LG', 'ウルトラワイド', 'UltraWide', 'モニター', 'monitor', '3440×1440', '3440x1440', '画面', '表示環境'],
    signals: ['hardware', 'monitor', 'workspace'],
  },
  {
    id: 'chair-sayl',
    family: 'workspace-chair',
    category: 'AI_DX',
    title: 'Herman Miller セイルチェア',
    description: '長時間の設計、レビュー、資料作成が続く業務環境を整えたい方向けの定番チェアです。',
    url: 'https://amzn.to/47NR4Xk',
    keywords: ['チェア', 'chair', 'Herman Miller', 'ハーマンミラー', '作業環境', '長時間作業', '姿勢', '腰', 'ergonomics'],
    signals: ['workspace'],
  },
  {
    id: 'neuro-dive',
    family: 'career-ai',
    type: 'career-service',
    category: 'AI_DX',
    title: 'AIやデータサイエンスが学べるIT特化の就労移行支援【Neuro Dive】',
    description: 'AI・データサイエンス領域へのキャリアチェンジを支援する就労移行支援サービスです。IT分野に特化したカリキュラムで、BIM・建設DX人材としてのスキルアップも視野に入れられます。',
    url: 'https://px.a8.net/svt/ejp?a8mat=4B1ILM+CVSP0Y+47GS+HVFKY',
    pixel: 'https://www12.a8.net/0.gif?a8mat=4B1ILM+CVSP0Y+47GS+HVFKY',
    linkText: '無料で詳細を見る',
    rel: 'nofollow noopener',
    keywords: ['AI', 'データサイエンス', 'キャリア', '就労', 'DX', '転職', 'スキルアップ', '建設DX', 'IT'],
    signals: ['ai', 'career', 'dx'],
  },
];

const FALLBACK_BY_CATEGORY = {
  REVIT: ['revit-book', 'fm-book'],
  GLOOBE: ['gloobe-book', 'fm-book'],
  BIM_AI: ['dx-book', 'revit-book'],
  AI_DX: ['neuro-dive', 'dx-book', 'ultrawide-lg'],
  BIM_ECOSYSTEM: ['fm-book', 'archicad-book'],
  OTHER: ['dx-book', 'fm-book'],
};

const POST_AFFILIATE_OVERRIDES = {
  'aec-magazine-march-april-2026': ['dx-book'],
  'ai': ['dx-book', 'rtx4090'],
  'ai-design-and-re-shaping-the-aec-industry': ['dx-book', 'fm-book'],
  'ai-in-aec-why-better-decisions-matter-more-than-faster-tools': ['dx-book', 'fm-book'],
  'autodesk-construction-cloud-is-now-autodesk-forma': ['fm-book', 'dx-book'],
  'autodesk-construction-cloud-to-join-autodesk-forma-on-march-24': ['fm-book', 'dx-book'],
  'autodesk-flow-studio-launches-wonder-3d-gen-ai-model-to-help-creators-make-3d-ch': ['rtx4090', 'dx-book'],
  'autodesk-invests-2m-in-construction-material-tracking-firm': ['dx-book', 'fm-book'],
  'autodesks-200m-bet-on-spatial-ai': ['dx-book', 'rtx4090'],
  'best-enterprise-workstation-laptops-2026': ['desktop-13700f', 'ultrawide-lg'],
  'can-a-small-workstation-handle-big-bim': ['desktop-12700f', 'ultrawide-lg'],
  'cityweft-adds-3d-building-data-for-england': ['survey-book', 'revit-book'],
  'cmap-introduces-cmap-intelligence': ['dx-book', 'ultrawide-lg'],
  'design-to-build-in-the-age-of-ai': ['dx-book', 'fm-book'],
  'embodied-carbon-calcs-for-bim-objects': ['fm-book', 'revit-book'],
  'expanding-fedramp-moderate-authorization-brings-connected-secure-future-to-autod': ['fm-book', 'dx-book'],
  'gloobebim': ['gloobe-book', 'fm-book'],
  'graphisoft-bluebeam-webinar-jp': ['archicad-book', 'fm-book'],
  'hexagon-multivista-connects-to-revizto': ['survey-book', 'fm-book'],
  'maxon-launches-redshift-for-archviz': ['rtx4090', 'ultrawide-gaming'],
  'nxt-bld-2026-a-decade-of-looking-around-corners': ['dx-book', 'fm-book'],
  'preserving-the-past-with-digital-innovation-autodesk-named-a-fast-company-most-i': ['survey-book', 'fm-book'],
  'procore-acquires-datagrid': ['dx-book', 'ultrawide-lg'],
  'rethinking-the-bim-platform': ['fm-book', 'revit-book'],
  'review-cyberpowerpc-intel-core-u7ws-workstation': ['desktop-13700f', 'ultrawide-lg'],
  'revitbim': ['revit-book', 'fm-book'],
  'rewriting-the-rules': ['dx-book', 'fm-book'],
  'the-agentic-future-of-bim': ['dx-book', 'fm-book'],
  'trimble-to-acquire-document-crunch-in-latest-contech-ma': ['dx-book', 'fm-book'],
  'why-gpu-memory-matters-for-cad-viz-and-ai': ['rtx4090', 'desktop-13700f'],
};

function normalizeText(text) {
  return String(text || '').toLowerCase();
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}

function inferArticleSignals(post) {
  const text = normalizeText(`${post.title || ''} ${post.titleJa || ''} ${post.postText || ''} ${post.bodyJa || ''} ${post.summary || ''}`);
  const category = String(post.category || 'OTHER').toUpperCase();
  const signals = new Set();

  if (category === 'REVIT' || hasAny(text, ['revit', 'ファミリ', 'autodesk'])) signals.add('revit');
  if (hasAny(text, ['archicad', 'アーキキャド', 'graphisoft', 'bluebeam'])) signals.add('archicad');
  if (category === 'GLOOBE' || hasAny(text, ['gloobe', '福井コンピュータ'])) signals.add('gloobe');

  if (hasAny(text, ['ifc', 'openbim', 'cde', 'construction cloud', 'autodesk construction cloud', 'acc', 'revizto', 'bluebeam', '要件定義', '維持管理', 'ファシリティマネジメント'])) {
    signals.add('governance');
    signals.add('integration');
  }

  if (hasAny(text, ['lca', '埋蔵炭素', 'エンボディドカーボン', 'embodied carbon', '炭素', '脱炭素'])) {
    signals.add('sustainability');
    signals.add('governance');
  }

  if (hasAny(text, ['ドローン', 'レーザ測量', '点群', '測量', 'lidar', 'scan', 'スキャン', 'reality capture', '現況', '文化遺産'])) {
    signals.add('capture');
    signals.add('survey');
  }

  if (category === 'BIM_AI' || category === 'AI_DX' || hasAny(text, ['ai', '人工知能', 'agent', 'エージェント', '生成ai'])) {
    signals.add('ai');
  }

  if (category === 'AI_DX' || hasAny(text, ['dx', '建設dx', '業務改革', 'm&a', '買収', '投資', 'platform', 'プラットフォーム', 'workflow', 'ワークフロー', 'contract', 'datagrid', 'document crunch', 'procore', 'trimble', 'cmap'])) {
    signals.add('dx');
    signals.add('strategy');
    signals.add('business');
  }

  if (hasAny(text, ['ワークステーション', 'workstation', 'ラップトップ', 'laptop', 'ノート', 'gpu', 'vram', 'rtx', 'レンダリング', 'redshift', 'モニター', 'monitor', 'ultrawide', 'ウルトラワイド', 'desktop', 'デスクトップ'])) {
    signals.add('hardware');
  }

  if (hasAny(text, ['gpu', 'vram', 'rtx', 'レンダリング', 'redshift', '可視化', 'viz', '3d'])) signals.add('gpu');
  if (hasAny(text, ['モニター', 'monitor', 'ウルトラワイド', 'ultrawide', '画面', '表示環境', 'レビュー'])) signals.add('monitor');
  if (hasAny(text, ['デスクトップ', 'desktop', 'workstation', 'ワークステーション', 'ラップトップ', 'laptop'])) signals.add('desktop');
  if (hasAny(text, ['チェア', 'chair', '作業環境', '長時間作業', '姿勢', '腰', 'ergonomics'])) signals.add('workspace');

  if (category === 'BIM_ECOSYSTEM' || category === 'REVIT' || category === 'GLOOBE') signals.add('bim-modeling');
  if (category === 'OTHER' && signals.size === 0) signals.add('business');

  return { text, category, signals };
}

function scoreAffiliateLink(post, link, context) {
  const { text, category, signals } = context;
  let score = 0;

  const keywordHits = link.keywords.reduce((count, keyword) => count + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
  score += keywordHits * 4;

  if (link.category === category) score += 2;
  for (const signal of link.signals || []) {
    if (signals.has(signal)) score += 3;
  }

  if (link.family === 'workspace-chair' && !signals.has('workspace')) score -= 6;
  if (link.family.startsWith('hardware') && !signals.has('hardware')) score -= 3;
  if (link.family === 'book-dx' && !signals.has('dx') && !signals.has('business') && !signals.has('ai')) score -= 3;
  if (link.family === 'book-archicad' && signals.has('revit') && !signals.has('archicad')) score -= 3;
  if (link.family === 'book-revit' && signals.has('archicad') && !signals.has('revit')) score -= 3;
  if (link.family === 'book-capture' && !signals.has('capture')) score -= 4;
  if (link.family === 'book-governance' && !(signals.has('governance') || signals.has('sustainability') || signals.has('integration'))) score -= 2;
  if (link.family === 'hardware-gpu' && !signals.has('gpu')) score -= 4;
  if (link.family === 'hardware-monitor' && !(signals.has('monitor') || signals.has('hardware'))) score -= 2;

  return score;
}

function uniqueByFamily(items) {
  const families = new Set();
  const result = [];
  for (const item of items) {
    if (families.has(item.family)) continue;
    families.add(item.family);
    result.push(item);
  }
  return result;
}

function getFallbackLinks(category) {
  const ids = FALLBACK_BY_CATEGORY[category] || FALLBACK_BY_CATEGORY.OTHER;
  return ids
    .map((id) => SITE_AFFILIATE_LINKS.find((item) => item.id === id))
    .filter(Boolean);
}

function getAffiliateLinks(post) {
  const manualIds = POST_AFFILIATE_OVERRIDES[post.slug];
  if (manualIds) {
    return manualIds
      .map((id) => SITE_AFFILIATE_LINKS.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, 2);
  }

  const context = inferArticleSignals(post);
  const scored = SITE_AFFILIATE_LINKS
    .map((link, index) => ({ link, index, score: scoreAffiliateLink(post, link, context) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.link);

  const diverse = uniqueByFamily(scored).slice(0, 2);
  if (diverse.length > 0) return diverse;

  return getFallbackLinks(context.category).slice(0, 2);
}

/**
 * Returns career-service affiliates when the article has AI/DX/career signals.
 * This is intentionally independent of POST_AFFILIATE_OVERRIDES so that the
 * career banner always appears on relevant articles regardless of product overrides.
 */
function getCareerAffiliates(post) {
  const text = normalizeText(
    `${post.title || ''} ${post.titleJa || ''} ${post.category || ''} ${post.postText || ''} ${post.bodyJa || ''} ${post.summary || ''}`
  );
  const category = String(post.category || '').toUpperCase();

  const hasCareerSignal =
    category === 'AI_DX' ||
    category === 'BIM_AI' ||
    hasAny(text, ['ai', 'dx', '人工知能', 'エージェント', 'agent', '建設dx', 'データサイエンス', 'キャリア', '就労', 'スキルアップ']);

  if (!hasCareerSignal) return [];

  return SITE_AFFILIATE_LINKS.filter((a) => a.type === 'career-service');
}

module.exports = { getAffiliateLink, appendAffiliateLink, applyAffiliateLinks, getAffiliateLinks, getCareerAffiliates };
