const output = document.querySelector('#diagnostic-output');
const button = document.querySelector('#diagnostic-run');
const now = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
async function run() {
  button.disabled = true;
  output.textContent = '確認しています…';
  const lines = [`MNPのりかえ Navi 配信診断（${now}）`];
  lines.push('診断コード：sitemap-v3（XML本文検査対応）');
  const check = (ok, label) => lines.push(`${ok ? 'OK' : '要確認'}：${label}`);
  try {
    const responses = await Promise.all(
      [
        '/',
        '/robots.txt',
        '/build-info.json',
        '/catalog.json',
        '/sitemap.xml',
      ].map((path) => fetch(path, { cache: 'no-store', credentials: 'omit' })),
    );
    const [home, robots, info, catalog, sitemap] = responses;
    responses
      .slice(0, 4)
      .forEach((r, index) =>
        check(
          r.ok,
          `${['トップページ', 'robots.txt', 'ビルド情報', '料金データ', 'サイトマップ'][index]} HTTP ${r.status}`,
        ),
      );
    if (responses.slice(0, 4).some((r) => !r.ok))
      throw new Error('取得できない項目があります');
    const html = await home.text(),
      rules = await robots.text(),
      build = await info.json(),
      data = await catalog.json();
    const document = new DOMParser().parseFromString(html, 'text/html');
    const noindex = (
      document.querySelector('meta[name="robots"]')?.content || ''
    ).includes('noindex');
    const disallow = /^Disallow:\s*\/\s*$/m.test(rules);
    lines.push(
      `配信モード：${build.production ? '正式公開設定' : '確認版設定'}`,
    );
    if (build.sourceCommit)
      lines.push(`配信コミット：${build.sourceCommit.slice(0, 7)}`);
    check(
      build.production ? !noindex && !disallow : noindex && disallow,
      '検索設定が配信モードと一致',
    );
    check(
      home.headers.get('x-content-type-options') === 'nosniff',
      'X-Content-Type-Options',
    );
    check(
      home.headers.get('x-frame-options')?.toUpperCase() === 'DENY',
      'X-Frame-Options',
    );
    const csp = home.headers.get('content-security-policy') || '';
    check(
      /script-src\s+'self'(?:;|\s)/.test(csp) &&
        /frame-ancestors\s+'none'/.test(csp),
      'Content-Security-Policy',
    );
    check(
      home.headers.get('referrer-policy') === 'strict-origin-when-cross-origin',
      'Referrer-Policy',
    );
    check(
      /camera=\(\)/.test(home.headers.get('permissions-policy') || ''),
      'Permissions-Policy',
    );
    check(
      document.querySelector('meta[name="google-site-verification"]')
        ?.content === 'eaIJri9lcP0T4RwPPBHuA5Ff4wpBPKTIlGUgFuHhc6U',
      'Google所有権確認タグ',
    );
    if (build.production) {
      check(
        document.querySelector('link[rel="canonical"]')?.href ===
          location.origin + '/',
        '正式公開URL',
      );
      check(
        rules.includes(`Sitemap: ${location.origin}/sitemap.xml`),
        'サイトマップURL',
      );
    }
    if (build.production) {
      check(sitemap.ok, `本番サイトマップ HTTP ${sitemap.status}`);
      const sitemapText = await sitemap.text();
      const xml = new DOMParser().parseFromString(
        sitemapText,
        'application/xml',
      );
      const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
      const xmlValid =
        xml.querySelector('parsererror') === null &&
        xml.documentElement.localName === 'urlset' &&
        xml.documentElement.namespaceURI === namespace;
      check(xmlValid, 'サイトマップXML構造');
      check(
        /(?:application|text)\/xml/i.test(
          sitemap.headers.get('content-type') || '',
        ),
        'サイトマップContent-Type',
      );
      check(
        !sitemap.redirected && sitemap.url === location.origin + '/sitemap.xml',
        'サイトマップにリダイレクトなし',
      );
      const urls = Array.from(
        xml.getElementsByTagNameNS(namespace, 'loc'),
        (node) => node.textContent.trim(),
      );
      lines.push(`サイトマップURL件数：${urls.length}`);
      if (build.production) {
        check(
          urls.length > 0 &&
            urls.every((url) => {
              try {
                return new URL(url).origin === location.origin;
              } catch {
                return false;
              }
            }),
          'サイトマップに同一サイトの絶対URLを収録',
        );
        check(new Set(urls).size === urls.length, 'サイトマップURL重複なし');
      }
      lines.push(`サイトマップ確認先：${location.origin}/sitemap.xml`);
      lines.push(
        'この診断は利用中のブラウザからの取得です。Googlebotからの取得可否はSearch Consoleの公開URLテストで確認してください。',
      );
    } else {
      lines.push(
        '確認版ではサイトマップを配信しません。正式公開後に送信してください。',
      );
    }
    const verified = data.plans.filter((p) => p.status === 'verified');
    check(
      verified.length > 0 &&
        verified.every(
          (p) =>
            p.checkedAt &&
            p.checkedAt <= now &&
            p.validThrough &&
            p.validThrough >= now,
        ),
      '確認済み料金データの確認期限',
    );
    lines.push(
      `登録：${data.carriers.length}ブランド／${verified.length}確認済みプラン`,
    );
    check(
      verified.filter((p) => p.carrierId === 'ymobile').length === 3,
      'ワイモバイル3プラン反映',
    );
    lines.push(
      '診断対象：HTTP配信・検索設定。料金の内容や端末の操作全般を保証するものではありません。',
    );
  } catch (error) {
    lines.push(`要確認：${error.message}`);
  } finally {
    output.textContent = lines.join('\n');
    button.disabled = false;
  }
}
button.addEventListener('click', run);
run();
