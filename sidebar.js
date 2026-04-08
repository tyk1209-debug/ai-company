'use strict';

function createSidebarTools({
  explainerGuides,
  explainerGuideMap,
  recommendedBooks,
  categoryLabel,
  categorySlug,
  escape,
  guideUrl,
}) {
  function buildSidebarWidget(title, content) {
    return `
      <div class="sidebar-widget">
        <div class="sidebar-widget-title">${escape(title)}</div>
        ${content}
      </div>`;
  }

  function buildSidebarLinkList(items, getHref, getLabel, options = {}) {
    const listClass = ['sidebar-recent-list', options.listClass].filter(Boolean).join(' ');
    const listAttrs = options.listAttrs ? ` ${options.listAttrs}` : '';
    return `
        <ul class="${listClass}"${listAttrs}>
          ${items.map((item) => `<li><a href="${escape(getHref(item))}">${escape(getLabel(item))}</a></li>`).join('')}
        </ul>`;
  }

  function buildSidebarGuideWidget(guides, base, intro) {
    if (!guides || guides.length === 0) return '';
    return buildSidebarWidget('基礎解説', `
        <p class="sidebar-about sidebar-widget-intro">${escape(intro)}</p>
        ${buildSidebarLinkList(guides, (guide) => guideUrl(guide.slug, base), (guide) => guide.title)}
        <a class="sidebar-follow-btn sidebar-widget-cta" href="${base}/guides/index.html">基礎解説をもっと見る</a>`);
  }

  function buildSidebarReferenceWidget(items, intro) {
    if (!items || items.length === 0) return '';
    return buildSidebarWidget('参考アイテム', `
        <p class="sidebar-about sidebar-widget-intro sidebar-widget-intro-wide">${escape(intro)}</p>
        <div class="sidebar-widget-stack">
          ${items.map((item) => `
          <article class="sidebar-widget-entry">
            <p class="sidebar-about sidebar-widget-entry-title">${escape(item.title)}</p>
            <p class="sidebar-about sidebar-widget-entry-copy">${escape(item.description)}</p>
            <a class="sidebar-follow-btn" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer sponsored">Amazonで見る</a>
          </article>`).join('')}
        </div>`);
  }

  function buildRecommendedBooks(categoryKey) {
    const books = recommendedBooks[categoryKey] || [];
    return buildSidebarReferenceWidget(
      books,
      'このカテゴリの理解や実務整理に役立つ書籍・ツールをまとめています。ニュースや基礎解説を読んだあとに、必要なものだけ選べる導線です。'
    );
  }

  function buildHomeSidebarWidgets(base = '.') {
    const guides = ['bim', 'revit', 'archicad', 'ifc']
      .map((slug) => explainerGuideMap[slug])
      .filter(Boolean);
    const learningWidget = buildSidebarGuideWidget(
      guides,
      base,
      'ニュース理解の前提になるテーマを先に整理できるよう、入口として読みやすい解説をまとめています。'
    );

    const homeItems = [
      recommendedBooks.REVIT && recommendedBooks.REVIT[0],
      recommendedBooks.BIM_ECOSYSTEM && recommendedBooks.BIM_ECOSYSTEM[0],
      recommendedBooks.BIM_ECOSYSTEM && recommendedBooks.BIM_ECOSYSTEM[2],
    ].filter(Boolean);

    const referenceWidget = buildSidebarReferenceWidget(
      homeItems,
      'BIMの基礎理解や実務整理に役立つ定番アイテムを、入口向けに絞って掲載しています。'
    );

    return {
      afterCategories: learningWidget,
      afterRecommendations: referenceWidget,
    };
  }

  function buildDailyRecommendationWidget(posts, base = '.') {
    const guideCandidates = explainerGuides.map((guide) => ({
      kind: 'guide',
      href: guideUrl(guide.slug, base),
      title: guide.title,
    }));
    const postCandidates = posts.map((post) => ({
      kind: 'post',
      href: `${base}/posts/${escape(post.slug)}.html`,
      title: post.titleJa || post.title,
    }));
    const candidates = [...postCandidates, ...guideCandidates];
    const fallbackItems = [
      ...posts.slice(0, 4).map((post) => ({
        kind: 'post',
        href: `${base}/posts/${escape(post.slug)}.html`,
        title: post.titleJa || post.title,
      })),
      ...(guideCandidates.length > 0 ? [guideCandidates[0]] : []),
    ].slice(0, 5);
    const candidatesJson = JSON.stringify(candidates).replace(/</g, '\\u003c');

    return `
      ${buildSidebarWidget('今日のおすすめ', buildSidebarLinkList(
        fallbackItems,
        (item) => item.href,
        (item) => item.title,
        { listClass: 'sidebar-daily-list', listAttrs: 'data-daily-recommendations' }
      ))}
      <script>
        (() => {
          const widget = document.currentScript.previousElementSibling;
          const list = widget ? widget.querySelector('[data-daily-recommendations]') : null;
          if (!list) return;
          const candidates = ${candidatesJson};
          if (!Array.isArray(candidates) || candidates.length === 0) return;

          const hashString = (value) => {
            let hash = 2166136261;
            for (let i = 0; i < value.length; i++) {
              hash ^= value.charCodeAt(i);
              hash = Math.imul(hash, 16777619);
            }
            return hash >>> 0;
          };

          const shuffleBySeed = (items, seed) => items
            .map((item, index) => ({
              item,
              sortKey: hashString(seed + '|' + index + '|' + item.href),
            }))
            .sort((a, b) => a.sortKey - b.sortKey)
            .map((entry) => entry.item);

          const escapeHtml = (value) => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

          const jstDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date());

          const guideItems = candidates.filter((item) => item.kind === 'guide');
          const mixedItems = shuffleBySeed(candidates, jstDate + '|mixed');
          const picks = [];

          if (guideItems.length > 0) {
            picks.push(shuffleBySeed(guideItems, jstDate + '|guide')[0]);
          }

          for (const item of mixedItems) {
            if (!picks.some((picked) => picked.href === item.href)) {
              picks.push(item);
            }
            if (picks.length >= 5) break;
          }

          list.innerHTML = picks.slice(0, 5).map((item) => {
            return '<li><a href="' + escapeHtml(item.href) + '">' + escapeHtml(item.title) + '</a></li>';
          }).join('');
        })();
      </script>`;
  }

  function buildSidebar(posts, base = '.', extraWidgets = '') {
    const catData = {};
    for (const post of posts) {
      const key = (post.category || 'OTHER').toUpperCase();
      const label = categoryLabel(post.category);
      if (!catData[key]) catData[key] = { label, count: 0 };
      catData[key].count++;
    }

    const catItems = Object.entries(catData)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, { label, count }]) =>
        `<li><a href="${base}/categories/${categorySlug(key)}.html">${escape(label)}</a><span class="sidebar-category-count">${count}</span></li>`
      ).join('');

    const weeklyPosts = posts
      .filter((post) => post.isWeekly === true)
      .slice(0, 5);
    const weeklyWidget = weeklyPosts.length > 0
      ? buildSidebarWidget('週次まとめ', buildSidebarLinkList(
          weeklyPosts,
          (post) => `${base}/posts/${post.slug}.html`,
          (post) => post.titleJa || post.title
        ))
      : '';

    const widgets = typeof extraWidgets === 'string'
      ? { beforeCategories: extraWidgets }
      : (extraWidgets || {});
    const beforeCategories = widgets.beforeCategories || widgets.beforePopular || '';
    const afterCategories = widgets.afterCategories ? `\n      ${widgets.afterCategories}` : '';
    const afterRecommendations = widgets.afterRecommendations
      ? `\n      ${widgets.afterRecommendations}`
      : (widgets.afterRecent ? `\n      ${widgets.afterRecent}` : '');

    return `
    <aside class="sidebar">
      ${beforeCategories}
      ${buildSidebarWidget('カテゴリ', `<ul class="sidebar-category-list">${catItems}</ul>`)}${afterCategories}
      ${buildDailyRecommendationWidget(posts, base)}${afterRecommendations}
      ${buildSidebarWidget('このサイトについて', '<p class="sidebar-about">AEC News JapanはBIM・AEC・建設DXの最新情報をAIが日本語で解説する専門メディアです。</p>')}${weeklyWidget}
    </aside>`;
  }

  function selectGuidesForCategory(categoryKey) {
    const category = (categoryKey || 'OTHER').toUpperCase();
    if (category === 'REVIT') {
      return ['revit', 'bim', 'bim-manager'].map((slug) => explainerGuideMap[slug]).filter(Boolean);
    }
    if (category === 'IFC') {
      return ['ifc', 'openbim', 'cde'].map((slug) => explainerGuideMap[slug]).filter(Boolean);
    }
    if (category === 'BIM_AI' || category === 'AI_DX' || category === 'AI') {
      return ['bim-ai', 'bim', 'bim-manager'].map((slug) => explainerGuideMap[slug]).filter(Boolean);
    }
    if (category === 'BIM_ECOSYSTEM' || category === 'ARCHICAD' || category === 'GLOOBE') {
      return ['bim', 'archicad', 'cde', 'bim-manager'].map((slug) => explainerGuideMap[slug]).filter(Boolean);
    }
    return ['bim', 'openbim', 'bim-manager'].map((slug) => explainerGuideMap[slug]).filter(Boolean);
  }

  function buildCategoryLearningSection(categoryKey) {
    const guides = selectGuidesForCategory(categoryKey).slice(0, 3);
    return buildSidebarGuideWidget(
      guides,
      '..',
      'このカテゴリを理解する前提知識を先に整理できます。ニュースを読む前の導入として使いやすい記事をまとめています。'
    );
  }

  return {
    buildSidebar,
    buildHomeSidebarWidgets,
    buildRecommendedBooks,
    buildCategoryLearningSection,
  };
}

module.exports = { createSidebarTools };
