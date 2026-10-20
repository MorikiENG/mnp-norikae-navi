import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Build into an isolated directory; this never deploys or changes preview output.
test('production build generates the approved origin and excludes pending pages from sitemap', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'mnp-production-test-'));
  try {
    await cp('data', path.join(cwd, 'data'), { recursive: true });
    await cp('src', path.join(cwd, 'src'), { recursive: true });
    // Keep a pending-only brand fixture to verify exclusion after the real catalog is fully reviewed.
    const fixturePath = path.join(cwd, 'data/catalog.json');
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    fixture.plans
      .filter((p) => p.carrierId === 'ymobile')
      .forEach((p) => {
        p.status = 'pending';
      });
    await writeFile(fixturePath, JSON.stringify(fixture));
    execFileSync(process.execPath, [path.resolve('scripts/build.mjs')], {
      cwd,
      env: {
        ...process.env,
        SITE_URL: 'https://mnp-test.example',
        PRODUCTION: 'true',
        PUBLICATION_APPROVED: 'true',
      },
      stdio: 'pipe',
    });
    const read = (file) => readFile(path.join(cwd, 'dist', file), 'utf8');
    const home = await read('index.html');
    assert.match(home, /rel="canonical" href="https:\/\/mnp-test\.example\/"/);
    assert.doesNotMatch(home, /noindex,nofollow/);
    assert.match(home, /<title>MNP乗り換え損益シミュレーション・料金比較/);
    const carrier = await read('carriers/ahamo/index.html');
    const structured = JSON.parse(carrier.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(structured.breadcrumb['@type'], 'BreadcrumbList');
    assert.deepEqual(structured.breadcrumb.itemListElement.map(x => [x.position, x.item]), [
      [1, 'https://mnp-test.example/'],
      [2, 'https://mnp-test.example/carriers/ahamo/'],
    ]);
    assert.match(carrier, /aria-label="パンくずリスト"/);
    assert.match(carrier, /aria-current="page">ahamoの料金とMNP比較/);
    for (const route of ['/guides/costs/', '/guides/benefits/', '/methodology/'])
      assert.ok(carrier.includes(`href="${route}"`), route);
    assert.doesNotMatch(await read('404/index.html'), /BreadcrumbList/);
    assert.doesNotMatch(await read('carriers/ymobile/index.html'), /BreadcrumbList/);
    assert.match(
      await read('robots.txt'),
      /Allow: \/\nSitemap: https:\/\/mnp-test\.example\/sitemap\.xml/,
    );
    const sitemap = await read('sitemap.xml');
    assert.match(
      sitemap,
      /<loc>https:\/\/mnp-test\.example\/carriers\/ahamo\/<\/loc>/,
    );
    assert.doesNotMatch(sitemap, /carriers\/ymobile|\/404\//);
    assert.match(await read('carriers/ymobile/index.html'), /noindex,nofollow/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('the string false is not publication approval', () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, ['scripts/build.mjs'], {
        env: {
          ...process.env,
          SITE_URL: 'https://mnp-test.example',
          PRODUCTION: 'true',
          PUBLICATION_APPROVED: 'false',
        },
        stdio: 'pipe',
      }),
    /Command failed/,
  );
});
