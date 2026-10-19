import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculate,
  rank,
  monthlyCharge,
  monthDate,
  date,
  money,
} from '../src/engine.mjs';
import { validateCatalog } from '../scripts/validate-data.mjs';
const catalog = JSON.parse(
  await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'),
);
const base = {
  carrier: 'au',
  monthly: 6000,
  dataGB: 10,
  callMinutes: 0,
  calls: 0,
  discount: 0,
  discountMonths: 0,
  balance: 0,
  balanceMonths: 0,
  newDevice: 0,
  overlap: 0,
  extraMonthly: 0,
  exitFee: 0,
  exitConfirmed: true,
  start: '2026-10-01',
  contractStart: '',
  conditions: [],
  futureIncrease: 0,
  increaseAfter: 0,
};
const plan = (id) => structuredClone(catalog.plans.find((p) => p.id === id));
test('catalog has all requested brands and validates', () =>
  assert.equal(validateCatalog(catalog), true));
test('hand-calculated 6/12/24 month example includes initial fee', () => {
  const r = calculate(plan('nihon-minna'), base);
  assert.equal(r.series[5].saving, 24360);
  assert.equal(r.series[11].saving, 52020);
  assert.equal(r.series[23].saving, 107340);
  assert.equal(r.breakEven, 1);
});
test('discount ends on the precise month', () => {
  const r = calculate(plan('nihon-minna'), {
    ...base,
    discount: 1000,
    discountMonths: 6,
  });
  assert.equal(r.series[5].stay, 30000);
  assert.equal(r.series[6].stay, 36000);
});
test('announced ahamo change applies December, with tier boundary', () => {
  const p = plan('ahamo');
  assert.equal(monthlyCharge(p, base, 1).yen, 2970);
  assert.equal(monthlyCharge(p, base, 2).yen, 3135);
  assert.equal(monthlyCharge(p, { ...base, dataGB: 40 }, 2).yen, 3135);
  assert.equal(monthlyCharge(p, { ...base, dataGB: 40.1 }, 2).yen, 4125);
  assert.equal(monthlyCharge(p, { ...base, dataGB: 60.1 }, 2).yen, 5115);
  assert.throws(() => monthlyCharge(p, { ...base, dataGB: 120.1 }, 2));
});
test('month stepping does not overflow at end of month', () =>
  assert.equal(monthDate('2026-01-31', 1), '2026-02-01'));
test('current plan price rise starts after specified number of months', () => {
  const r = calculate(plan('nihon-minna'), {
    ...base,
    futureIncrease: 165,
    increaseAfter: 2,
  });
  assert.equal(r.series[2].stay, 18165);
});
test('existing device balance cancels from savings and stops after final payment', () => {
  const a = calculate(plan('nihon-minna'), base),
    b = calculate(plan('nihon-minna'), {
      ...base,
      balance: 12000,
      balanceMonths: 6,
    });
  assert.equal(b.saving, a.saving);
  assert.equal(b.series[5].stay - a.series[5].stay, 12000);
  assert.equal(b.series[6].stay - a.series[6].stay, 12000);
});
test('new device, exit fee, and overlap are separate costs', () => {
  const a = calculate(plan('nihon-minna'), base),
    b = calculate(plan('nihon-minna'), {
      ...base,
      newDevice: 20000,
      exitFee: 1100,
      overlap: 3000,
    });
  assert.equal(a.saving - b.saving, 24100);
});
test('unknown and invalid amounts never become zero', () => {
  for (const value of [null, undefined, NaN, Infinity, -1, '0', false])
    assert.throws(() => money(value));
  assert.throws(() =>
    calculate({ ...plan('nihon-minna'), initialFee: null }, base),
  );
  assert.throws(() =>
    calculate(plan('nihon-minna'), { ...base, exitFee: null }),
  );
  assert.throws(() =>
    calculate(plan('nihon-minna'), { ...base, exitConfirmed: false }),
  );
});
test('pending and expired prices excluded; exact expiry day valid', () => {
  assert.throws(() => calculate(plan('ymobile-review'), base));
  assert.throws(() => calculate(plan('nihon-minna'), base, 24, '2026-11-19'));
  assert.doesNotThrow(() =>
    calculate(plan('nihon-minna'), base, 24, '2026-11-18'),
  );
});
test('required eligibility is not assumed', () => {
  assert.throws(() => calculate(plan('rakuten-saikyo'), base));
  assert.doesNotThrow(() =>
    calculate(plan('rakuten-saikyo'), {
      ...base,
      conditions: ['rakuten-up-to-four'],
    }),
  );
  assert.throws(() => calculate(plan('povo-sub30'), base));
});
test('family discount only when condition is selected', () => {
  const p = plan('rakuten-saikyo');
  const a = { ...base, conditions: ['rakuten-up-to-four'] };
  assert.equal(
    calculate(p, { ...a, conditions: [...a.conditions, 'rakuten-family'] })
      .saving - calculate(p, a).saving,
    2640,
  );
});
test('Rakuten Link free calls only with explicit condition', () => {
  const p = plan('rakuten-saikyo'),
    i = { ...base, callMinutes: 100, calls: 10 };
  assert.equal(monthlyCharge(p, i, 0).yen, 3278);
  assert.equal(
    monthlyCharge(p, { ...i, conditions: ['rakuten-link'] }, 0).yen,
    2178,
  );
});
test('call billing rounds each equal-length call up to 30 seconds', () => {
  assert.equal(
    monthlyCharge(plan('mineo-15'), { ...base, callMinutes: 1, calls: 3 }, 0)
      .yen,
    2024,
  );
  assert.equal(
    monthlyCharge(plan('ahamo'), { ...base, callMinutes: 51, calls: 10 }, 0)
      .yen,
    3190,
  );
});
test('benefits require confirmed eligibility and correct receipt month', () => {
  const p = plan('nihon-minna');
  p.benefits = [
    {
      type: 'cash',
      amount: 5000,
      month: 7,
      from: '2026-10-01',
      until: '2026-10-31',
      verified: true,
      requires: ['entry'],
    },
    {
      type: 'points',
      amount: 10000,
      month: 13,
      from: '2026-10-01',
      until: '2026-10-31',
      verified: true,
      requires: ['entry'],
    },
  ];
  const no = calculate(p, base),
    yes = calculate(p, { ...base, conditions: ['entry'] });
  assert.equal(yes.series[5].cash, 0);
  assert.equal(yes.series[6].cash, 5000);
  assert.equal(yes.series[11].points, 0);
  assert.equal(yes.series[12].points, 10000);
  assert.equal(yes.saving - no.saving, 5000);
  p.benefits[0].verified = false;
  assert.equal(
    calculate(p, { ...base, conditions: ['entry'] }).saving,
    no.saving,
  );
});
test('expired promotion is not applied', () => {
  const p = plan('nihon-minna');
  p.benefits = [
    {
      type: 'cash',
      amount: 5000,
      month: 1,
      from: '2026-01-01',
      until: '2026-09-30',
      verified: true,
      requires: [],
    },
  ];
  assert.equal(calculate(p, base).cash, 0);
});
test('point amount cannot affect ranking', () => {
  const a = plan('nihon-minna'),
    b = { ...plan('nihon-minna'), id: 'more-expensive', initialFee: 4000 };
  b.benefits = [
    {
      type: 'points',
      amount: 999999,
      month: 1,
      from: '2026-10-01',
      until: '2026-10-31',
      verified: true,
      requires: [],
    },
  ];
  assert.equal(rank([b, a], base).eligible[0].plan.id, a.id);
});
test('break-even ignores temporary saving followed by loss', () => {
  const p = plan('nihon-minna');
  const r = calculate(p, { ...base, monthly: 1000 });
  assert.equal(r.breakEven, null);
  const q = plan('nihon-minna');
  q.benefits = [
    {
      type: 'cash',
      amount: 5000,
      month: 1,
      from: '2026-10-01',
      until: '2026-10-31',
      verified: true,
      requires: [],
    },
  ];
  assert.equal(calculate(q, { ...base, monthly: 1000 }).breakEven, null);
});
test('same brand and insufficient high-speed capacity excluded', () => {
  assert.throws(() =>
    calculate(plan('nihon-minna'), { ...base, carrier: 'nihon' }),
  );
  assert.throws(() =>
    calculate(plan('nihon-minna'), { ...base, dataGB: 20.1 }),
  );
});
test('new application after closed plan date is excluded', () =>
  assert.throws(() =>
    calculate(plan('docomo-mini4'), {
      ...base,
      start: '2026-12-01',
      dataGB: 1,
    }),
  ));
test('missing future tariff is not guessed', () => {
  const p = plan('nihon-minna');
  p.prices[0].until = '2026-11-30';
  assert.throws(() => calculate(p, base));
});
test('input validates dates, discount size, fractional months and residual term', () => {
  assert.throws(() => date('2026-02-30'));
  assert.throws(() =>
    calculate(plan('nihon-minna'), { ...base, discount: 7000 }),
  );
  assert.throws(() =>
    calculate(plan('nihon-minna'), { ...base, discountMonths: 1.5 }),
  );
  assert.throws(() =>
    calculate(plan('nihon-minna'), {
      ...base,
      balance: 1000,
      balanceMonths: 0,
    }),
  );
  assert.throws(() =>
    calculate(plan('nihon-minna'), { ...base, callMinutes: 1, calls: 0 }),
  );
  assert.throws(() =>
    calculate(plan('nihon-minna'), { ...base, contractStart: '2026-11-01' }),
  );
});
test('schema rejects overlapping versions and unsourced confirmed benefits', () => {
  const c = structuredClone(catalog);
  c.plans[0].prices.push({ ...c.plans[0].prices[0] });
  assert.throws(() => validateCatalog(c));
  const d = structuredClone(catalog);
  d.plans[0].benefits = [
    {
      type: 'cash',
      amount: 1,
      month: 1,
      from: '2026-01-01',
      until: '2026-12-01',
      requires: [],
      verified: true,
    },
  ];
  assert.throws(() => validateCatalog(d));
});

test('same-month contract date is valid for monthly simulation', () =>
  assert.doesNotThrow(() =>
    calculate(plan('nihon-minna'), { ...base, contractStart: '2026-10-10' }),
  ));
