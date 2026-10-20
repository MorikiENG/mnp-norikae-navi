import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, cp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for (const scenario of [
  {
    name: 'Cloudflare main uses the recorded publication approval',
    pages: '1',
    branch: 'main',
    approved: true,
    production: true,
  },
  {
    name: 'Cloudflare preview stays excluded from search',
    pages: '1',
    branch: 'feature/test',
    approved: true,
    production: false,
  },
  {
    name: 'local build stays excluded from search',
    approved: true,
    production: false,
  },
  {
    name: 'unapproved main stays excluded from search',
    pages: '1',
    branch: 'main',
    approved: false,
    production: false,
  },
]) {
  test(scenario.name, async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'mnp-publication-'));
    try {
      await cp('data', path.join(cwd, 'data'), { recursive: true });
      await cp('src', path.join(cwd, 'src'), { recursive: true });
      const policyPath = path.join(cwd, 'data/publication.json');
      const policy = JSON.parse(await readFile(policyPath, 'utf8'));
      policy.approved = scenario.approved;
      await writeFile(policyPath, JSON.stringify(policy));
      const env = { ...process.env };
      for (const name of [
        'SITE_URL',
        'PRODUCTION',
        'PUBLICATION_APPROVED',
        'CF_PAGES',
        'CF_PAGES_BRANCH',
      ])
        delete env[name];
      if (scenario.pages) env.CF_PAGES = scenario.pages;
      if (scenario.branch) env.CF_PAGES_BRANCH = scenario.branch;
      execFileSync(process.execPath, [path.resolve('scripts/build.mjs')], {
        cwd,
        env,
        stdio: 'pipe',
      });
      const info = JSON.parse(
        await readFile(path.join(cwd, 'dist/build-info.json'), 'utf8'),
      );
      assert.equal(info.production, scenario.production);
      const html = await readFile(path.join(cwd, 'dist/index.html'), 'utf8');
      async function checkAds(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const file = path.join(dir, entry.name);
          if (entry.isDirectory()) await checkAds(file);
          else if (entry.name.endsWith('.html') && entry.name !== 'googled86428f90575e69a.html') {
            const content = await readFile(file, 'utf8');
            const head = content.split('</head>')[0];
            assert.equal((head.match(/src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-7686370936641694"/g) || []).length, scenario.production ? 1 : 0, file);
          }
        }
      }
      await checkAds(path.join(cwd, 'dist'));
      const headers = await readFile(path.join(cwd, 'dist/_headers'), 'utf8');
      assert.equal(headers.includes('https://*.googlesyndication.com'), scenario.production);
      const robots = await readFile(path.join(cwd, 'dist/robots.txt'), 'utf8');
      if (scenario.production) {
        const sitemap = await readFile(
          path.join(cwd, 'dist/sitemap.xml'),
          'utf8',
        );
        assert.doesNotMatch(html, /noindex,nofollow/);
        assert.match(
          html,
          /rel="canonical" href="https:\/\/mnp-norikae-navi.pages.dev\/"/,
        );
        assert.match(
          robots,
          /Allow: \/\nSitemap: https:\/\/mnp-norikae-navi.pages.dev\/sitemap.xml/,
        );
        assert.match(
          sitemap,
          /https:\/\/mnp-norikae-navi.pages.dev\/carriers\/ymobile\//,
        );
        assert.doesNotMatch(sitemap, /\/diagnostics\/|\/404\//);
      } else {
        await assert.rejects(readFile(path.join(cwd, 'dist/sitemap.txt')), {
          code: 'ENOENT',
        });
        await assert.rejects(readFile(path.join(cwd, 'dist/sitemap.xml')), {
          code: 'ENOENT',
        });
        assert.match(html, /noindex,nofollow/);
        assert.match(robots, /Disallow: \//);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
