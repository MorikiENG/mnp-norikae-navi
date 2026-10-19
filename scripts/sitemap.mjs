const xmlEscape = (value) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character],
  );
function sitemapUrls(origin, paths) {
  if (!paths.length) throw new Error('本番サイトマップが空です');
  const base = new URL(origin);
  if (
    base.protocol !== 'https:' ||
    base.pathname !== '/' ||
    base.search ||
    base.hash ||
    base.username ||
    base.password
  )
    throw new Error('サイトマップの公開URLが不正です');
  const urls = paths.map((path) => {
    if (!path.startsWith('/') || path.startsWith('//') || /[\r\n]/.test(path))
      throw new Error('サイトマップのページパスが不正です');
    const url = new URL(path, base);
    if (url.origin !== base.origin || url.hash || url.href.length >= 2048)
      throw new Error('サイトマップの収録URLが不正です');
    return url.href;
  });
  if (new Set(urls).size !== urls.length)
    throw new Error('サイトマップURLが重複しています');
  return urls;
}

export function sitemapText(origin, paths) {
  return sitemapUrls(origin, paths).join('\n') + '\n';
}

export function sitemapXml(origin, paths) {
  const urls = sitemapUrls(origin, paths);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url>\n    <loc>${xmlEscape(url)}</loc>\n  </url>`),
    '</urlset>',
    '',
  ].join('\n');
}
