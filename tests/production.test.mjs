import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Build into an isolated directory; this never deploys or changes preview output.
test('production build generates the approved origin and excludes pending pages from sitemap', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'mnp-production-test-'));
  try {
    await cp('data', path.join(cwd, 'data'), { recursive: true });
    await cp('src', path.join(cwd, 'src'), { recursive: true });
    execFileSync(process.execPath, [path.resolve('scripts/build.mjs')], {
      cwd,
      env: { ...process.env, SITE_URL: 'https://mnp-test.example', PRODUCTION: 'true', PUBLICATION_APPROVED: 'true' },
      stdio: 'pipe',
    });
    const read = (file) => readFile(path.join(cwd, 'dist', file), 'utf8');
    const home = await read('index.html');
    assert.match(home, /rel="canonical" href="https:\/\/mnp-test\.example\/"/);
    assert.doesNotMatch(home, /noindex,nofollow/);
    assert.match(await read('robots.txt'), /Allow: \/\nSitemap: https:\/\/mnp-test\.example\/sitemap\.xml/);
    const sitemap = await read('sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/mnp-test\.example\/carriers\/ahamo\/<\/loc>/);
    assert.doesNotMatch(sitemap, /carriers\/ymobile|\/404\//);
    assert.match(await read('carriers/ymobile/index.html'), /noindex,nofollow/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('the string false is not publication approval', () => {
  assert.throws(() => execFileSync(process.execPath, ['scripts/build.mjs'], {
    env: { ...process.env, SITE_URL: 'https://mnp-test.example', PRODUCTION: 'true', PUBLICATION_APPROVED: 'false' },
    stdio: 'pipe',
  }), /Command failed/);
});
