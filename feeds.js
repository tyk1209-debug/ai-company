/**
 * feeds.js
 * RSS収集対象の定義
 * BIM / AEC / 建設DX / AI に特化したソースに絞る
 */

module.exports = [
  // ── Autodesk 系 ──────────────────────────────────────────
  {
    name: "Autodesk AEC Blog",
    url: "https://www.autodesk.com/blogs/aec/feed/",
  },
  // 削除: Autodesk News（adsknews.autodesk.com が 2026-09 時点でRSS配信を廃止。
  //       200は返すが item が0件で、feed宣言もページから消えている。
  //       Autodesk関連は Autodesk AEC Blog で拾う）

  // ── Graphisoft / Archicad 系 ──────────────────────────────
  {
    name: "Graphisoft Blog",
    // 旧 blog.graphisoft.com は DNS ごと消滅。本体ドメインの feed に移行済み。
    url: "https://graphisoft.com/feed",
  },
  // 削除: Graphisoft Insights Japan（community.graphisoft.com が Cloudflare 判定で常時403）
  // 削除: BIM Design Japan（https://bim-design.com/feed/ が 404、RSS配信自体を停止）

  // ── openBIM / buildingSMART 系 ────────────────────────────
  {
    name: "buildingSMART International",
    url: "https://www.buildingsmart.org/feed/",
  },

  // ── AEC / 建設テック専門メディア ─────────────────────────
  // 削除: AECbytes（配信URLが全て404、RSS提供終了）
  {
    name: "AEC Magazine",
    url: "https://aecmag.com/feed/",
    category: "BIM_ECOSYSTEM",
  },
  {
    name: "Construction Dive",
    url: "https://www.constructiondive.com/feeds/news/",
  },
  // 削除: ENR（www.enr.com が Cloudflare 判定で常時403）
  {
    name: "ArchDaily",
    url: "https://www.archdaily.com/feed/",
  },
  {
    name: "Dezeen",
    url: "https://www.dezeen.com/feed/",
    category: "CONSTRUCTION_TECH",
  },

  // ── AI / GPU 技術系（BIM接続性が高い）───────────────────
  {
    name: "NVIDIA Blog",
    url: "https://blogs.nvidia.com/feed/",
  },

  // ── 日本語ソース ──────────────────────────────────────────
  {
    name: "AppTec ニュース",
    url: "https://www.apptec.co.jp/news/feed/",
    category: "CONSTRUCTION_TECH",
  },
  {
    name: "建設ITワールド",
    url: "https://ken-it.world/feed",
  },
  {
    name: "日経クロステック",
    url: "https://xtech.nikkei.com/rss/index.rdf",
  },
  {
    name: "BIMゲート",
    url: "https://bimgate.jp/feed/",
    category: "BIM_ECOSYSTEM",
  },
  {
    name: "Graphisoft Japan",
    url: "https://www.graphisoft.com/jp/feed",
    category: "BIM_ECOSYSTEM",
  },
  // 削除: Vectorworks Blog（rss.xml がリダイレクトループ＋XML不正で解析不能）
  // 削除: Nemetschek Group（/en/feed はHTMLを返す。scraper.js の Nemetschek Newsroom で取得済み）
  {
    name: "NYKシステムズ（Rebro）",
    url: "https://www.nyk-systems.co.jp/feed/",
    category: "BIM_ECOSYSTEM",
  },
];
