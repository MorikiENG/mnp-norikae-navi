import { rank } from './engine.mjs';
const $ = (s) => document.querySelector(s),
  form = $('#calculator');
const yen = (n) =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 2,
  }).format(n);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const now = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
form.elements.startMonth.value = now.slice(0, 7);
form.elements.startMonth.min = now.slice(0, 7);
let catalog,
  input,
  horizon = 12,
  results;
try {
  const r = await fetch('/catalog.json');
  if (!r.ok) throw Error();
  catalog = await r.json();
} catch {
  $('#form-error').textContent =
    '料金データを読み込めませんでした。時間をおいて再読み込みしてください。';
  form.querySelector('button[type=submit]').disabled = true;
}
const carrier = (p) => catalog.carriers.find((c) => c.id === p.carrierId).name;
function readInput() {
  const f = new FormData(form),
    i = {
      carrier: f.get('carrier'),
      start: f.get('startMonth') + '-01',
      contractStart: f.get('contractStart'),
      conditions: f.getAll('conditions'),
      exitConfirmed: f.has('exitConfirmed'),
    };
  for (const k of [
    'monthly',
    'dataGB',
    'callMinutes',
    'calls',
    'discount',
    'discountMonths',
    'balance',
    'balanceMonths',
    'newDevice',
    'overlap',
    'extraMonthly',
    'exitFee',
    'futureIncrease',
    'increaseAfter',
  ]) {
    const raw = f.get(k);
    if (raw === null || raw.trim() === '')
      throw Error(
        '必要な数値を入力してください。不明な費用を0円にしないでください。',
      );
    i[k] = Number(raw);
  }
  if (i.contractStart && i.contractStart > now)
    throw Error('現在の契約開始日に未来の日付は入力できません');
  if (i.start.slice(0, 7) < now.slice(0, 7))
    throw Error('今月以降の乗り換え月を選んでください');
  return i;
}
function render() {
  results = rank(catalog.plans, input, horizon, now);
  const distinct = results.eligible.filter(
    (r, i, all) =>
      all.findIndex((x) => x.plan.carrierId === r.plan.carrierId) === i,
  );
  $('#result-status').textContent =
    `${distinct.length}ブランド・${results.eligible.length}プランを比較しました。${horizon}か月の現金支出で並べています。`;
  $('#rankings').innerHTML = distinct.length
    ? distinct
        .map((r, index) => {
          const p = r.plan,
            s = r.series[horizon - 1],
            good = s.saving > 0;
          return `<article class="result-card ${index === 0 ? 'best' : ''}">${index === 0 ? `<div class="best-label">${good ? '確認済み条件内で最も節約' : '確認済み条件内の最小負担'} / ${horizon}か月</div>` : ''}<div class="card-top"><div><div class="carrier-label">${String(index + 1).padStart(2, '0')}　${esc(carrier(p))}</div><h3>${esc(p.name)}</h3><span class="badge">${esc(r.series[0].call)}</span></div><div class="saving ${good ? '' : 'negative'}"><span>${horizon}か月で${good ? '節約' : '負担増'}</span><strong>${yen(Math.abs(s.saving))}<small> 円相当ではなく現金差額</small></strong></div></div><div class="metrics"><div class="metric">初月の通信料金<b>${yen(r.series[0].monthly)}</b></div><div class="metric">${horizon}か月の現金負担<b>${yen(s.switched)}</b></div><div class="metric">損益分岐点<b>${r.breakEven ? `${r.breakEven}か月目` : '24か月以内なし'}</b></div></div><div class="card-foot"><span>確認 ${esc(p.checkedAt)} · ポイント ${s.points.toLocaleString('ja-JP')}pt（別枠）</span><button type="button" data-detail="${esc(p.id)}">内訳・グラフを見る ↗</button></div></article>`;
        })
        .join('')
    : '<div class="empty"><h3>比較できるプランがありません</h3><p>必要容量・確認済み条件・データの確認期限をご確認ください。</p></div>';
  $('#excluded').innerHTML =
    `<details><summary>比較対象外のプランと理由（${results.excluded.length}件）</summary><ul class="small">${results.excluded.map((x) => `<li>${esc(x.plan.name)}：${esc(x.reason)}</li>`).join('')}</ul></details>`;
  $('#breakdown').hidden = true;
  $('#rankings')
    .querySelectorAll('[data-detail]')
    .forEach((b) =>
      b.addEventListener('click', () => detail(b.dataset.detail)),
    );
}
function graph(r) {
  const max = Math.max(1, ...r.series.flatMap((s) => [s.stay, s.switched]));
  const min = Math.min(0, ...r.series.map((s) => s.switched));
  const y = (n) => 200 - ((n - min) / (max - min)) * 160;
  const path = (key) =>
    r.series
      .map(
        (s, index) =>
          `${index ? 'L' : 'M'}${50 + (index / 23) * 500},${y(s[key])}`,
      )
      .join(' ');
  return `<svg class="chart" viewBox="0 0 600 250" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">24か月の累計現金支出</title><desc id="chart-desc">継続 ${yen(r.series[23].stay)}、乗り換え ${yen(r.series[23].switched)}。同じ値は下の比較表でも確認できます。</desc>${[0, 0.5, 1].map((f) => `<line x1="50" x2="550" y1="${200 - f * 160}" y2="${200 - f * 160}"/><text x="45" y="${204 - f * 160}" text-anchor="end">${Math.round((min + (max - min) * f) / 10000)}万</text>`).join('')}<path class="stay" d="${path('stay')}"/><path class="switch" d="${path('switched')}"/>${[1, 6, 12, 18, 24].map((m) => `<text x="${50 + ((m - 1) / 23) * 500}" y="225" text-anchor="middle">${m}か月</text>`).join('')}</svg>`;
}
function detail(id) {
  const r = results.eligible.find((r) => r.plan.id === id),
    p = r.plan,
    box = $('#breakdown');
  box.innerHTML = `<div class="form-body"><h3>${esc(p.name)} の比較内訳</h3><p class="small">契約事務・SIM発行費 ${yen(r.initial)} ＋ 解約費 ${yen(input.exitFee)} ＋ 新端末 ${yen(input.newDevice)} ＋ 重複請求等 ${yen(input.overlap)}。残債は継続・乗り換えの両方に計上。</p>${graph(r)}<div class="legend"><span>継続した場合</span><span>乗り換えた場合</span></div><div class="table-wrap"><table><caption>税込・累計額（法定付加料金等は対象外）</caption><thead><tr><th scope="col">期間</th><th scope="col">継続</th><th scope="col">乗り換え</th><th scope="col">現金差額</th><th scope="col">別枠ポイント</th></tr></thead><tbody>${[
    6, 12, 24,
  ]
    .map((m) => {
      const s = r.series[m - 1];
      return `<tr><th scope="row">${m}か月</th><td>${yen(s.stay)}</td><td>${yen(s.switched)}</td><td>${yen(s.saving)}</td><td>${s.points}pt</td></tr>`;
    })
    .join(
      '',
    )}</tbody></table></div><p class="small">${esc(p.note)}</p><p class="small">通話は確認済みオプションの中で月ごとに最小費用となるものを選択。未確認のオプション・特典を含まないため、最安を保証しません。ポイントを差し引いた金額で順位を変更しません。</p><p>${p.sources.map((url, index) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">公式情報${index + 1} ↗</a>`).join('　')}</p><p class="small">公式サイトへの通常リンクです。広告リンクではありません。</p><button type="button" id="download" class="primary">この比較をCSVで保存</button></div>`;
  box.hidden = false;
  box.focus();
  $('#download').addEventListener('click', () => {
    const rows = [
      [
        '期間（月）',
        '継続（円）',
        '乗り換え（円）',
        '現金節約（円）',
        '別枠ポイント（pt）',
      ],
      ...r.series.map((s) => [s.month, s.stay, s.switched, s.saving, s.points]),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    a.download = 'mnp-comparison.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    input = readInput();
    render();
    $('#form-error').textContent = '';
    $('#results').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  } catch (e) {
    $('#form-error').textContent = e.message;
  }
});
form.addEventListener('input', () => {
  if (input) {
    $('#result-status').textContent =
      '入力条件が変わりました。再計算してください。';
    $('#rankings').innerHTML = '';
    $('#breakdown').hidden = true;
    $('#excluded').innerHTML = '';
    input = null;
  }
});
document.querySelectorAll('[data-period]').forEach((b) =>
  b.addEventListener('click', () => {
    horizon = Number(b.dataset.period);
    document
      .querySelectorAll('[data-period]')
      .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (input) render();
  }),
);
