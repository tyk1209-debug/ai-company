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
  {
    name: "Autodesk News",
    url: "https://adsknews.autodesk.com/feed",
  },

  // ── Graphisoft / Archicad 系 ──────────────────────────────
  {
    name: "Graphisoft Blog",
    url: "https://blog.graphisoft.com/feed/",
  },

  // ── openBIM / buildingSMART 系 ────────────────────────────
  {
    name: "buildingSMART International",
    url: "https://www.buildingsmart.org/feed/",
  },

  // ── AEC / 建設テック専門メディア ─────────────────────────
  {
    name: "AECbytes",
    url: "https://www.aecbytes.com/aecbytes-news-and-reviews-feed.rss",
  },
  {
    name: "AEC Magazine",
    url: "https://aecmag.com/feed/",
    category: "BIM_ECOSYSTEM",
  },
  {
    name: "Construction Dive",
    url: "https://www.constructiondive.com/feeds/news/",
  },
  {
    name: "ENR - Engineering News-Record",
    url: "https://www.enr.com/rss/news",
  },
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
    name: "建設ITワールド",
    url: "https://ken-it.world/feed",
  },
  {
    name: "日経クロステック",
    url: "https://xtech.nikkei.com/rss/index.rdf",
  },
];
