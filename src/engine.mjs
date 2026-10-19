/** All amounts are tax-inclusive JPY. No implicit null -> zero conversion. */
export const money = (n, label = '金額') => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e9)
    throw new Error(`${label}を0以上の数値で入力してください`);
  return n;
};
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('日付を確認してください');
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== value)
    throw new Error('日付を確認してください');
  return d;
}
export function monthDate(start, offset) {
  const d = date(start);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 10);
}
export function validateInput(i) {
  [
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
    'futureIncrease',
    'increaseAfter',
  ].forEach((k) => money(i[k], k));
  ['calls', 'discountMonths', 'balanceMonths', 'increaseAfter'].forEach((k) => {
    if (!Number.isInteger(i[k]))
      throw new Error('回数・月数は整数で入力してください');
  });
  if (i.discount > i.monthly)
    throw new Error('割引額は割引前の月額以下にしてください');
  if (i.balance > 0 && i.balanceMonths < 1)
    throw new Error('端末残債の支払い月数を入力してください');
  if (i.calls === 0 && i.callMinutes > 0)
    throw new Error('通話回数を入力してください');
  if (i.calls > 10000 || i.callMinutes > 100000 || i.dataGB > 1000)
    throw new Error('利用量が入力範囲を超えています');
  date(i.start);
  if (i.contractStart) {
    date(i.contractStart);
    if (i.contractStart.slice(0, 7) > i.start.slice(0, 7))
      throw new Error('契約開始日が乗り換え月より後です');
  }
  money(i.exitFee, '確認済みの解約費用');
  if (!i.exitConfirmed)
    throw new Error(
      '現在の契約条件で解約費用を確認してください（不明な費用は0円にできません）',
    );
}
function versionAt(plan, when) {
  return plan.prices
    .filter((v) => v.from <= when && (!v.until || when <= v.until))
    .sort((a, b) => b.from.localeCompare(a.from))[0];
}
export function monthlyCharge(plan, i, offset) {
  const when = monthDate(i.start, offset),
    v = versionAt(plan, when);
  if (!v) throw new Error('将来の料金が未確認です');
  const tier = v.tiers.find((t) => t.upToGB === null || i.dataGB <= t.upToGB);
  if (!tier) throw new Error('必要な高速データ容量に対応していません');
  const base = money(tier.yen);
  const perCall = i.calls ? i.callMinutes / i.calls : 0;
  const options = plan.callOptions
    .filter((o) => !o.requires || i.conditions.includes(o.requires))
    .map((o) => {
      // Estimate equally long calls, rounding each call to a 30-second billing unit.
      const minutes = Math.max(0, perCall - o.freePerCall);
      const billedMinutes = o.freeTotal
        ? Math.max(0, i.callMinutes - o.freeTotal)
        : null;
      const units = o.unlimited
        ? 0
        : billedMinutes !== null
          ? Math.ceil(billedMinutes * 2)
          : i.calls * Math.ceil(minutes * 2);
      return {
        name: o.name,
        yen: money(o.monthly) + units * money(plan.callPer30sec),
      };
    });
  if (!options.length) throw new Error('通話条件が未確認です');
  const best = options.sort((a, b) => a.yen - b.yen)[0];
  const discounts = (plan.discounts || []).filter(
    (d) =>
      i.conditions.includes(d.id) &&
      (!d.until || when <= d.until) &&
      (!d.months || offset < d.months),
  );
  const discount = discounts.reduce((s, d) => s + money(d.yen), 0);
  return {
    yen: round(Math.max(0, base - discount) + best.yen + i.extraMonthly),
    base,
    call: best.name,
    discount,
  };
}
export function calculate(plan, i, months = 24, today = i.start) {
  validateInput(i);
  if (!Number.isInteger(months) || months < 1 || months > 120)
    throw new Error('比較期間を確認してください');
  if (
    plan.status !== 'verified' ||
    !plan.checkedAt ||
    !plan.validThrough ||
    today > plan.validThrough
  )
    throw new Error('料金データが未確認または確認期限切れです');
  if (plan.carrierId === i.carrier)
    throw new Error('同じブランド内の変更はMNPランキング対象外です');
  if (plan.availableUntil && i.start > plan.availableUntil)
    throw new Error('新規受付期間が終了しています');
  const initial = money(plan.initialFee, '契約事務・SIM発行手数料');
  if (plan.initialRequires && !i.conditions.includes(plan.initialRequires))
    throw new Error('契約事務手数料の適用条件を確認してください');
  let stay = 0,
    switched = i.exitFee + initial + i.newDevice + i.overlap,
    points = 0,
    cash = 0;
  const series = [];
  for (let m = 1; m <= months; m++) {
    const device = m <= i.balanceMonths ? i.balance / i.balanceMonths : 0;
    const stayMonthly =
      i.monthly -
      (m <= i.discountMonths ? i.discount : 0) +
      (m > i.increaseAfter ? i.futureIncrease : 0);
    stay += stayMonthly + device;
    const fee = monthlyCharge(plan, i, m - 1);
    switched += fee.yen + device;
    for (const b of plan.benefits || []) {
      if (
        b.month !== m ||
        !b.verified ||
        !b.requires.every((c) => i.conditions.includes(c)) ||
        i.start < b.from ||
        i.start > b.until
      )
        continue;
      if (b.type === 'cash') {
        switched -= money(b.amount);
        cash += b.amount;
      } else if (b.type === 'points') points += money(b.amount);
    }
    series.push({
      month: m,
      stay: round(stay),
      switched: round(switched),
      saving: round(stay - switched),
      points,
      cash,
      monthly: fee.yen,
      call: fee.call,
    });
  }
  // A transient positive month is not a durable break-even point.
  const breakEven =
    series.find(
      (p, index) =>
        p.saving >= 0 && series.slice(index).every((q) => q.saving >= 0),
    )?.month ?? null;
  return {
    plan,
    series,
    breakEven,
    initial,
    points,
    cash,
    saving: series.at(-1).saving,
  };
}
export function rank(plans, i, horizon = 12, today = i.start) {
  if (![6, 12, 24].includes(horizon))
    throw new Error('比較期間を選択してください');
  validateInput(i);
  const eligible = [],
    excluded = [];
  for (const p of plans) {
    try {
      const result = calculate(p, i, 24, today);
      result.rankSaving = result.series[horizon - 1].saving;
      eligible.push(result);
    } catch (e) {
      excluded.push({ plan: p, reason: e.message });
    }
  }
  eligible.sort(
    (a, b) => b.rankSaving - a.rankSaving || a.plan.id.localeCompare(b.plan.id),
  );
  return { eligible, excluded };
}
