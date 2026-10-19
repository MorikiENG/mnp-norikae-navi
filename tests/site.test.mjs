import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
const env = { ...process.env, PRODUCTION: 'false', SITE_URL: '' };
execFileSync(process.execPath, ['scripts/build.mjs'], { env, stdio: 'pipe' });
async function htmlFiles(dir) {
  const results = [];
  for (const x of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, x.name);
    if (x.isDirectory()) results.push(...(await htmlFiles(p)));
    else if (p.endsWith('.html')) results.push(p);
  }
  return results;
}
test('generated pages have Japanese language, titles, metadata and no unresolved templates', async () => {
  for (const f of await htmlFiles('dist')) {
    if (path.basename(f) === 'googled86428f90575e69a.html') continue;
    const h = await readFile(f, 'utf8');
    assert.match(h, /<html lang="ja">/, f);
    assert.match(h, /<title>[^<]+<\/title>/, f);
    assert.match(h, /name="description" content="[^"]+"/, f);
    assert.match(h, /application\/ld\+json/, f);
    assert.doesNotMatch(h, /\{\{[A-Z_]+\}\}/, f);
  }
});
test('internal page and asset links resolve', async () => {
  for (const f of await htmlFiles('dist')) {
    const h = await readFile(f, 'utf8');
    for (const m of h.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
      const u = m[1].split('#')[0].split('?')[0];
      if (!u) continue;
      const target = path.join('dist', u, u.endsWith('/') ? 'index.html' : '');
      await assert.doesNotReject(access(target), `${f} -> ${u}`);
    }
  }
});
test('unapproved ads do not load third-party scripts or affiliated links', async () => {
  const h = await readFile('dist/index.html', 'utf8');
  assert.doesNotMatch(h, /<script[^>]+src="https?:/);
  assert.doesNotMatch(h, /rel="sponsored/);
  assert.doesNotMatch(h, /googlesyndication|adsbygoogle/);
});
test('staging remains noindex and has no invented canonical origin', async () => {
  const h = await readFile('dist/index.html', 'utf8');
  assert.match(h, /noindex,nofollow/);
  assert.doesNotMatch(h, /rel="canonical"/);
  assert.match(await readFile('dist/robots.txt', 'utf8'), /Disallow: \//);
});
test('production build refuses missing origin and approval', () => {
  assert.throws(() =>
    execFileSync(process.execPath, ['scripts/build.mjs'], {
      env: { ...env, PRODUCTION: 'true' },
      stdio: 'pipe',
    }),
  );
  assert.throws(() =>
    execFileSync(process.execPath, ['scripts/build.mjs'], {
      env: {
        ...env,
        PRODUCTION: 'true',
        SITE_URL: 'https://example.com',
        PUBLICATION_APPROVED: '',
      },
      stdio: 'pipe',
    }),
  );
});
test('Cloudflare headers enforce same-origin scripts and block embedding', async () => {
  const s = await readFile('dist/_headers', 'utf8');
  assert.match(s, /script-src 'self'/);
  assert.match(s, /frame-ancestors 'none'/);
});
test('calculator source stores no contract data and uses no external API', async () => {
  const s = await readFile('src/app.mjs', 'utf8');
  assert.doesNotMatch(
    s,
    /localStorage|sessionStorage|document\.cookie|fetch\(['"]https?:/,
  );
  assert.match(s, /fetch\('\/catalog.json'\)/);
});

test('Google ownership file is served verbatim without a page wrapper', async () => {
  assert.equal(await readFile('dist/googled86428f90575e69a.html', 'utf8'), 'google-site-verification: googled86428f90575e69a.html\n');
});

test('homepage includes the operator-provided Google verification tag in its head', async () => {
  const head = (await readFile('dist/index.html', 'utf8')).split('</head>')[0];
  assert.match(head, /<meta name="google-site-verification" content="eaIJri9lcP0T4RwPPBHuA5Ff4wpBPKTIlGUgFuHhc6U">/);
});

test('delivery diagnostics stays noindex and its script is included', async () => {
 const html = await readFile('dist/diagnostics/index.html', 'utf8');
 assert.match(html, /noindex,nofollow/);
 assert.match(html, /src="\/diagnostics.mjs"/);
 await access('dist/diagnostics.mjs');
});
