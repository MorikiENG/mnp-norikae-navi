import { createHash } from 'node:crypto';
import { sitemapXml } from './sitemap.mjs';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
const data = JSON.parse(await readFile('data/catalog.json', 'utf8'));
const ads = JSON.parse(await readFile('data/ads.json', 'utf8'));
const diagnosticHash = createHash('sha256')
  .update(await readFile('src/diagnostics.mjs'))
  .digest('hex')
  .slice(0, 12);
const diagnosticAsset = `/diagnostics-${diagnosticHash}.mjs`;
const publication = JSON.parse(await readFile('data/publication.json', 'utf8'));
// Cloudflare's main deployment may use the operator-approved tracked policy.
// Local builds and other branches stay noindex unless explicitly configured.
const approvedPagesMain =
  process.env.CF_PAGES === '1' &&
  process.env.CF_PAGES_BRANCH === publication.branch &&
  publication.approved === true &&
  Boolean(publication.approvalRecord);
const production =
  process.env.PRODUCTION === undefined
    ? approvedPagesMain
    : process.env.PRODUCTION === 'true';
const origin = (
  process.env.SITE_URL ?? (production ? publication.origin : '')
).replace(/\/$/, '');
const publicationApproved =
  process.env.PUBLICATION_APPROVED === undefined
    ? approvedPagesMain
    : process.env.PUBLICATION_APPROVED === 'true';
if (
  production &&
  process.env.CF_PAGES === '1' &&
  process.env.CF_PAGES_BRANCH !== publication.branch
)
  throw Error('プレビュー用ブランチは検索対象として公開できません');

if (origin && !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))
  throw Error('SITE_URLにはパスなしのHTTPS URLを指定してください');
if (production && !origin) throw Error('本番ビルドにはSITE_URLが必要です');
if (production && !publicationApproved)
  throw Error('本番公開前の検証・承認記録が必要です');
if (
  ads.adsense.approved &&
  (!/^ca-pub-\d{16}$/.test(ads.adsense.publisherId) ||
    !ads.adsense.approvalRecord)
)
  throw Error('AdSense承認記録が必要です');
for (const a of ads.affiliates)
  if (a.approved && (!a.approvalRecord || !/^https:\/\//.test(a.url)))
    throw Error('広告リンクの承認記録とHTTPS URLが必要です');
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const yen = (n) =>
  n === null
    ? '確認中'
    : new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(n) +
      '円';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
const pages = [];
const header = `<a class="skip" href="#main">本文へスキップ</a><header><div class="header-inner"><a class="logo" href="/"><span class="logo-icon" aria-hidden="true">⇄</span>MNPのりかえ <span style="color:var(--brand)">Navi</span></a><nav aria-label="メインメニュー"><a href="/#calculator">損益を計算</a><a href="/data-status/">料金データ</a><a href="/methodology/">計算のしくみ</a></nav></div></header>`;
const footer = `<footer><div class="wrap"><div class="footer-row"><div><b>MNPのりかえ Navi</b><p>運営：森樹エンジニアリング</p></div><div class="footer-links"><a href="/about/">運営者情報</a><a href="/privacy/">プライバシー</a><a href="/advertising/">広告掲載ポリシー</a><a href="/methodology/">計算のしくみ</a></div></div><p class="small">© 2026 森樹エンジニアリング　｜　各社の商標は各権利者に帰属します。</p></div></footer>`;
async function page(
  path,
  title,
  description,
  content,
  { home = false, index = true } = {},
) {
  const url = origin + path;
  const json = {
    '@context': 'https://schema.org',
    '@type': home ? 'WebApplication' : 'WebPage',
    name: title,
    description,
    inLanguage: 'ja',
    ...(origin ? { url } : {}),
    ...(home
      ? {
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Any',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
        }
      : {}),
  };
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}${home ? '' : ' | MNPのりかえ Navi'}</title><meta name="description" content="${esc(description)}"><meta name="google-site-verification" content="eaIJri9lcP0T4RwPPBHuA5Ff4wpBPKTIlGUgFuHhc6U"><meta name="theme-color" content="#087e74">${!production || !index ? '<meta name="robots" content="noindex,nofollow">' : ''}${origin ? `<link rel="canonical" href="${esc(url)}"><meta property="og:url" content="${esc(url)}">` : ''}<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"><script type="application/ld+json">${JSON.stringify(json).replace(/</g, '\\u003c')}</script>${home ? '<script type="module" src="/app.mjs"></script>' : ''}</head><body>${header}<main id="main" class="${home ? 'wrap' : 'legal'}">${content}</main>${footer}</body></html>`;
  const destination =
    path === '/' ? 'dist/index.html' : `dist${path}index.html`;
  await mkdir(destination.slice(0, destination.lastIndexOf('/')), {
    recursive: true,
  });
  await writeFile(destination, html);
  if (index) pages.push(path);
}
const links = data.carriers
  .map(
    (c) =>
      `<a class="data-link" href="/carriers/${c.id}/"><span>${esc(c.name)}</span><small>${data.plans.some((p) => p.carrierId === c.id && p.status === 'verified') ? '確認済みあり' : '確認中'} ↗</small></a>`,
  )
  .join('');
let home = await readFile('src/home.html', 'utf8');
home = home
  .replace(
    '{{CARRIER_OPTIONS}}',
    data.carriers
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join(''),
  )
  .replace('{{CARRIER_LINKS}}', links);
await page(
  '/',
  'MNPのりかえ Navi｜その乗り換え、本当にお得？',
  '携帯電話のMNP乗り換えでいくら変わる？公式確認済み料金と手数料から6・12・24か月の損益を無料比較。会員登録不要、ブラウザ内で計算。',
  home,
  { home: true },
);
const content = {
  about: [
    '運営者情報',
    '森樹エンジニアリングが運営する無料のMNP乗り換え比較サービス。',
    `<h1>運営者情報</h1><p>「MNPのりかえ Navi」は、森樹エンジニアリングが運営する無料のWebサービスです。携帯電話の料金を見直す際に、月額だけでなく乗り換えにかかる費用も含めて検討できることを目的としています。</p><h2>編集・更新方針</h2><p>料金・条件は各社の公式情報を一次情報として確認し、確認日と出典を掲載します。自動検知だけで料金を変更せず、内容の確認を経て更新します。広告報酬は計算・ランキングの変数に含めません。</p><h2>ご利用にあたって</h2><p>結果は入力条件と確認済みの代表プランに基づく概算です。通信品質、端末の対応状況、店舗サポート等の価値は順位に反映しません。契約を保証・仲介するものではありません。</p><h2>お問い合わせ・訂正の連絡先</h2><p>森樹エンジニアリング<br>メール：<a href="mailto:moriki.engineering@gmail.com">moriki.engineering@gmail.com</a></p><p>料金データの訂正は、対象ページ・誤りの内容・公式の参照URLを添えてご連絡ください。<a href="https://github.com/MorikiENG/mnp-norikae-navi/issues">GitHub Issues</a>からも受け付けています。電話番号、契約番号、本人確認書類などは送らないでください。</p>`,
  ],
  privacy: [
    'プライバシーポリシー',
    '入力情報の取り扱いと外部通信について。',
    `<h1>プライバシーポリシー</h1><p>制定日：2026年10月19日<br>運営：森樹エンジニアリング</p><h2>計算に入力する情報</h2><p>氏名・電話番号・メールアドレス・住所は求めません。月額料金、利用量、契約開始日などの入力は、ブラウザ内のメモリで計算に使用します。当サービスのサーバーへ送信せず、Cookieやローカルストレージにも保存しません。再読み込みすると消去されます。CSV保存は端末内の操作です。</p><h2>外部への通信</h2><p>ページと料金データの取得時、ホスティング事業者にIPアドレス等の接続情報が送信されます。確認版はCloudflare Pagesで配信しています。<a href="https://www.cloudflare.com/privacypolicy/">Cloudflareのプライバシーポリシー</a>をご確認ください。公式サイトへのリンクを開くと、リンク先の方針が適用されます。入力条件をURLに付加しません。</p><h2>広告・解析</h2><p>現在、AdSense、アフィリエイト広告、アクセス解析は有効にしていません。第三者広告スクリプトや広告Cookieを読み込みません。導入時には送信先、送信項目、目的、選択方法を明示し、必要な同意管理を実装して本方針を更新します。広告の有無にかかわらず計算機能を利用できます。</p><h2>お問い合わせ</h2><p>窓口：森樹エンジニアリング（<a href="mailto:moriki.engineering@gmail.com">moriki.engineering@gmail.com</a>）。メールでお送りいただいたメールアドレスと本文は、お問い合わせへの対応・ご連絡・料金情報の誤りの確認に使用します。メールはGmailで受信します。計算に入力した内容が自動的に添付・送信されることはありません。電話番号、契約番号、本人確認書類などは送らないでください。<a href="/about/">運営者情報</a>もご確認ください。</p>`,
  ],
  advertising: [
    '広告掲載ポリシー',
    '広告とランキングの関係、広告掲載条件を公開します。',
    `<h1>広告掲載ポリシー</h1><p>当サービスはGoogle AdSenseと携帯キャリア関連のアフィリエイトによる運営を予定しています。現在、広告配信・提携リンクは有効にしていません。</p><h2>順位は経済的な条件で決めます</h2><p>ユーザーが選んだ6・12・24か月の現金支出差額で並べます。ポイントは別枠です。広告単価、成果報酬、提携の有無は順位に影響しません。</p><h2>広告の表示</h2><p>承認済みの広告のみ掲載し、「広告」または「PR」と表示します。通常の公式サイトへのリンクと区別し、広告リンクには sponsored 属性を付けます。入力ボタンと誤認する配置・表現は使用しません。</p><h2>掲載前の確認</h2><p>提携承認、広告主の条件、リンク先、プライバシーポリシー、必要な同意管理を確認してから有効にします。未承認の広告を掲載せず、広告ブロッカーを使用しても計算は動作します。</p>`,
  ],
  methodology: [
    '計算方法と比較の範囲',
    '損益計算・ランキング・ポイントと現金・除外条件について。',
    `<h1>計算方法と比較の範囲</h1><h2>現金の差額を比べる</h2><p>節約額＝継続した場合の累計費用－乗り換えた場合の累計現金支出。プラスなら節約、マイナスなら負担増です。「年間節約額」は最初の12か月の差額で、短期割引の影響があるため翌年も同額になるとは限りません。</p><p>継続費用には入力月額、期限付き割引、入力された値上げ、端末残債を含めます。乗り換え費用には通信・通話料金、契約事務・SIM発行手数料、現在の契約の確認済み解約料、新端末購入額、重複請求等、端末残債を含めます。</p><h2>ポイントと特典</h2><p>現金特典は確認済み条件を満たし、受取月に到達した場合のみ支出から引きます。ポイントは受取月以降に別枠で表示し、現金支出・損益分岐点・順位から差し引きません。現在の初期データには、条件一式を確認できたキャンペーン特典を登録していません。0pt表示は「特典が存在しない」という意味ではありません。</p><h2>割引と通話</h2><p>登録済み割引は適用条件が選択された期間に限って算入します。セット回線の新規契約や有料カードの加入を前提とする割引は、初期データに含めません。通話時間は1回あたり均等と仮定し、30秒ごとに切り上げます。月合計無料分は月合計から控除する概算です。登録・確認済みの通話オプションの中で低額なものを選びます。全オプションを網羅せず、実際の発信先・各通話の長さにより費用が変わります。</p><h2>残債と端末代</h2><p>残債は支払い月数で均等に割り、継続・乗り換えの両方に計上します。新端末費用は乗り換え側の初月に全額計上します。残価設定、端末返却、免除、下取りは未対応です。</p><h2>比較期間と対象外</h2><p>各月1日からの満額計算で、日割りは行いません。法定付加料金、SMS、国際・対象外通話、セット回線・有料カードの費用等は比較範囲外です。総請求額を示すものではありません。将来の未発表改定は予測せず、確認時点の料金が続くシナリオです。予定改定が確認できた場合は適用月以降に反映します。</p><p>同一ブランド内の変更、必要高速容量を満たさないもの、未確認・確認期限切れの料金、申込条件を確認できないものはランキングから除外します。対象外の料金を0円に置き換えません。povoは月単位のサブスクのみ対象とし、有効期間30日を1か月として扱いません。</p><h2>損益分岐点と順位</h2><p>24か月以内で累計差額が0円以上になり、その後24か月目まで赤字にならない最初の月を表示します。比較期間の現金差額で降順に並べ、同額はプランIDの順です。ランキングではブランドごとに最も有利な確認済みプランを1件表示します。通信品質や利便性を保証する順位ではありません。</p>`,
  ],
  'guides/costs': [
    'MNPで見落としやすい費用',
    '解約料、重複請求、端末残債を分けて乗り換え費用を整理。',
    `<h1>MNPで見落としやすい費用</h1><p>月額が安くなっても、最初の数か月は手数料の分だけ支出が増えることがあります。乗り換え先の月額だけでなく、継続する場合との累計差額を確かめましょう。</p><h2>解約料は「今の契約」で確認</h2><p>契約時期、現在の料金プラン、解約までの期間や利用状況で条件が異なります。キャリア名だけで0円と判断せず、公式窓口・契約書面で確認した金額を入力してください。開始日だけで自動判定しないのは、この違いを省かないためです。</p><h2>解約月と開始月の請求</h2><p>日割りの有無や締め日が違うと、同じ月に2回線分がかかる場合があります。この計算機は満額の月単位で比較するため、重複請求が見込まれる場合は詳細条件に追加します。</p><h2>端末残債は消えない</h2><p>通信契約を解約しても端末代の支払いが続くことがあります。残債と新しく購入する端末代は分けて入力します。返却で残りの支払いが免除される契約は、本計算では再現できないため契約条件を別途確認してください。</p><h2>家族・セット割への影響</h2><p>1回線の移動で、残る家族回線や固定回線の割引が減る可能性があります。単独回線での節約だけで決めず、世帯全体の差額も整理しましょう。共通の追加負担は詳細条件に入力できます。</p>`,
  ],
  'guides/benefits': [
    'ポイント還元の正しい比べ方',
    '受取条件・時期・用途を確認してキャンペーンを比較する方法。',
    `<h1>ポイント還元の正しい比べ方</h1><p>「最大○円相当」の表現には、複数の条件や別々の特典が含まれることがあります。もらえる金額を決める前に、条件をひとつずつ確認しましょう。</p><h2>対象外にならないか</h2><p>乗り換え元、初回契約かどうか、対象プラン、エントリー、有料オプション、指定アプリの利用などが条件になる場合があります。条件達成のために払う費用も合わせて検討します。</p><h2>いつ、何として受け取るか</h2><p>現金、請求額の値引き、ポイントは同じではありません。受取が数か月後なら、短期の支出は軽くならないことがあります。ポイントの利用期限・使い道・分割付与も確認します。</p><h2>このサイトでの扱い</h2><p>ポイントは現金節約額から差し引きません。適用条件と受取月まで確認できない特典は算入しません。初期データに掲載していないキャンペーンもあるため、申込前に各社公式ページを確認してください。</p>`,
  ],
};
for (const [slug, [t, d, c]] of Object.entries(content))
  await page(`/${slug}/`, t, d, c);
const summary = `<h1>料金データの確認状況</h1><p>調査日：${data.researchDate}。公式ページの通常料金・オンライン申込を中心に確認した代表プランです。全プランを網羅しません。確認期限は調査から30日とし、期限を超えたデータは計算対象から除外します。期間限定キャンペーンは条件一式を確認できるまで算入しません。</p><div class="table-wrap"><table><thead><tr><th>ブランド</th><th>登録</th><th>確認済み</th><th>状況</th></tr></thead><tbody>${data.carriers
  .map((c) => {
    const ps = data.plans.filter((p) => p.carrierId === c.id);
    return `<tr><th><a href="/carriers/${c.id}/">${esc(c.name)}</a></th><td>${ps.length}</td><td>${ps.filter((p) => p.status === 'verified').length}</td><td>${esc(c.note)}</td></tr>`;
  })
  .join(
    '',
  )}</tbody></table></div><p>確認済みは公式情報を照合して入力した状態です。本番公開の承認は別に必要です。自動更新は候補をPRとして作り、確認済み料金ファイルを直接書き換えません。</p>`;
await page(
  '/data-status/',
  '料金データの確認状況',
  '対象12ブランドの登録・確認済み・未確認情報と参照元。',
  summary,
);
for (const c of data.carriers) {
  const ps = data.plans.filter((p) => p.carrierId === c.id),
    verified = ps.filter((p) => p.status === 'verified');
  const rows = ps
    .map(
      (p) =>
        `<tr><th scope="row">${esc(p.name)}</th><td>${p.status === 'verified' ? '確認済み' : '確認中'}</td><td>${
          p.prices
            .flatMap((v) =>
              v.tiers.map(
                (t) =>
                  `${v.from}～${v.until || ''} ${t.upToGB ?? '無制限'}${t.upToGB === null ? '' : 'GB'} ${yen(t.yen)}`,
              ),
            )
            .map(esc)
            .join('<br>') || '確認中'
        }</td><td>${yen(p.initialFee)}</td><td>${p.checkedAt || '—'}</td></tr>`,
    )
    .join('');
  await page(
    `/carriers/${c.id}/`,
    `${c.name}の料金とMNP比較`,
    `${c.name}の確認済み代表プラン・費用・注意事項と公式参照先。`,
    `<h1>${esc(c.name)}の料金とMNP比較</h1><p>${esc(c.note)}</p><p>全プランではなく、下記の代表プランを比較します。割引前・税込の通常料金が基本です。期間限定特典や未確認の割引を加算しません。通話・通信制限条件は公式情報を確認してください。</p><div class="table-wrap"><table><thead><tr><th>プラン</th><th>状態</th><th>基本料金・容量</th><th>初期費用</th><th>確認日</th></tr></thead><tbody>${rows}</tbody></table></div>${verified.map((p) => `<h2>${esc(p.name)}の確認条件</h2><p>${esc(p.note)}</p><p>国内通常通話：${yen(p.callPer30sec)}/30秒。${p.callOptions.map((o) => `${esc(o.name)}：月額${yen(o.monthly)}`).join('、')}。対象外の発信・SMS等は別費用です。</p>`).join('')}<h2>選ぶ前に確認すること</h2><p>必要な高速データ容量、よく使う場所での通信状況、端末対応、通話オプション、家族割への影響を確認しましょう。新規契約の条件と既存契約の条件が異なることもあります。</p><p><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.name)}公式の料金情報 ↗</a>（通常リンク）</p>${ads.affiliates
      .filter((a) => a.approved && a.carrierId === c.id)
      .map(
        (a) =>
          `<p>広告・PR：<a href="${esc(a.url)}" rel="sponsored noopener noreferrer" target="_blank">${esc(a.label)}</a></p>`,
      )
      .join('')}<p><a href="/#calculator">自分の条件で損益を計算する →</a></p>`,
    { index: verified.length > 0 },
  );
}
await page(
  '/404/',
  'ページが見つかりません',
  'ページが見つかりません。',
  `<h1>ページが見つかりません</h1><p><a href="/">トップページへ戻る</a></p>`,
  { index: false },
);
await page(
  '/diagnostics/',
  '配信設定の確認',
  'ブラウザ内で配信ヘッダーと検索設定を確認します。',
  `<h1>配信設定の確認</h1><p>このサイトの公開情報をブラウザ内で読み取ります。診断結果を外部に送信・保存しません。</p><button type="button" id="diagnostic-run" class="primary">再確認する</button><pre id="diagnostic-output" role="status" style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.8"></pre><p>結果をコピーするか、画面を共有して確認に使えます。</p><script type="module" src="${diagnosticAsset}"></script>`,
  { index: false },
);
await cp('src/diagnostics.mjs', 'dist/diagnostics.mjs');
await cp('src/diagnostics.mjs', `dist${diagnosticAsset}`);
await cp('dist/404/index.html', 'dist/404.html');
for (const file of ['app.mjs', 'engine.mjs', 'style.css'])
  await cp(`src/${file}`, `dist/${file}`);
await cp('data/catalog.json', 'dist/catalog.json');
await cp('src/googled86428f90575e69a.html', 'dist/googled86428f90575e69a.html');
await writeFile(
  'dist/favicon.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#087e74"/><path d="M14 23h34l-8-8m10 26H16l8 8" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
);
await writeFile(
  'dist/robots.txt',
  production
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n',
);
if (production) await writeFile('dist/sitemap.xml', sitemapXml(origin, pages));
await writeFile(
  'dist/_headers',
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'\n/catalog.json\n  Cache-Control: public, max-age=300\n/diagnostics/*\n  Cache-Control: no-store\n/build-info.json\n  Cache-Control: no-store\n/robots.txt\n  Cache-Control: no-cache\n/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n  Cache-Control: no-cache\n`,
);
await writeFile(
  'dist/build-info.json',
  JSON.stringify(
    {
      production,
      origin: origin || null,
      sourceCommit: /^[a-f0-9]{40}$/i.test(
        process.env.CF_PAGES_COMMIT_SHA || '',
      )
        ? process.env.CF_PAGES_COMMIT_SHA
        : null,
      researchDate: data.researchDate,
      plans: data.plans.length,
    },
    null,
    2,
  ),
);
console.log(
  `Built ${pages.length} indexable-content pages (publication=${production}, origin=${origin || 'unset'}).`,
);
