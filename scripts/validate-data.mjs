import { readFile } from 'node:fs/promises';
import { date, money } from '../src/engine.mjs';
export function validateCatalog(c) {
  if (
    c.schemaVersion !== 1 ||
    c.carriers.length !== 12 ||
    !Array.isArray(c.plans)
  )
    throw Error('カタログ構造が不正です');
  const ids = new Set(),
    carriers = new Set(c.carriers.map((x) => x.id));
  if (carriers.size !== 12) throw Error('キャリアIDが重複');
  const url = (u) => {
    const v = new URL(u);
    if (v.protocol !== 'https:' || v.username || v.password)
      throw Error('HTTPSの公式URLが必要です');
  };
  for (const x of c.carriers) url(x.url);
  for (const p of c.plans) {
    if (ids.has(p.id) || !carriers.has(p.carrierId))
      throw Error('プランIDまたはキャリアが不正');
    ids.add(p.id);
    if (!['verified', 'pending'].includes(p.status))
      throw Error('確認状態が不正');
    if (!p.sources?.length) throw Error('出典が必要');
    p.sources.forEach(url);
    if (p.status !== 'verified') continue;
    date(p.checkedAt);
    date(p.validThrough);
    if (p.validThrough < p.checkedAt) throw Error('確認期限が不正');
    if ((+date(p.validThrough) - date(p.checkedAt)) / 86400000 > 30)
      throw Error('確認期限は最大30日');
    if (p.availableUntil) date(p.availableUntil);
    money(p.initialFee);
    money(p.callPer30sec);
    if (!p.prices.length || !p.callOptions.length)
      throw Error('料金・通話条件が必要');
    let previous = null;
    for (const v of p.prices) {
      date(v.from);
      if (v.until) date(v.until);
      if (v.until && v.until < v.from) throw Error('料金適用期間が不正');
      if (previous && (!previous.until || previous.until >= v.from))
        throw Error('料金期間が重複');
      previous = v;
      if (!v.tiers.length) throw Error('容量別料金が必要');
      let last = -1;
      for (const [index, t] of v.tiers.entries()) {
        money(t.yen);
        if (t.upToGB === null) {
          if (index !== v.tiers.length - 1) throw Error('無制限は最後に指定');
          last = Infinity;
        } else {
          money(t.upToGB);
          if (t.upToGB <= last) throw Error('容量は昇順');
          last = t.upToGB;
        }
      }
    }
    for (const o of p.callOptions) {
      money(o.monthly);
      money(o.freePerCall);
      if (o.freeTotal !== undefined) money(o.freeTotal);
    }
    for (const d of p.discounts) {
      money(d.yen);
      if (d.until) date(d.until);
      if (
        d.months !== undefined &&
        (!Number.isInteger(d.months) || d.months < 1)
      )
        throw Error('割引期間が不正');
    }
    for (const b of p.benefits) {
      money(b.amount);
      date(b.from);
      date(b.until);
      if (
        !['cash', 'points'].includes(b.type) ||
        !Number.isInteger(b.month) ||
        b.month < 1 ||
        b.until < b.from ||
        !Array.isArray(b.requires)
      )
        throw Error('特典条件が不正');
      if (b.verified && !b.source) throw Error('確認済み特典の出典が必要');
    }
  }
  return true;
}
if (process.argv[1]?.endsWith('validate-data.mjs')) {
  const c = JSON.parse(await readFile('data/catalog.json', 'utf8'));
  validateCatalog(c);
  console.log(
    `Catalog OK: ${c.carriers.length} carriers, ${c.plans.filter((p) => p.status === 'verified').length}/${c.plans.length} verified plans`,
  );
}
