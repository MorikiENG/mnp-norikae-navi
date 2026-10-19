import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitemapXml, sitemapText } from '../scripts/sitemap.mjs';
test('sitemap escapes URL data and puts XML declaration at byte zero', () => {
  const xml = sitemapXml('https://example.com', ['/', '/?a=1&b=2']);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
  assert.match(xml, /<loc>https:\/\/example.com\/\?a=1&amp;b=2<\/loc>/);
  assert.ok(xml.endsWith('</urlset>\n'));
});
test('sitemap rejects empty, duplicate, cross-host and embedded-newline entries', () => {
  for (const paths of [
    [],
    ['/', '/'],
    ['//other.example/'],
    ['https://other.example/'],
    ['/bad\npath'],
  ]) {
    assert.throws(() => sitemapXml('https://example.com', paths));
  }
});

test('plain text sitemap contains exactly one unescaped absolute URL per line', () => {
  const txt = sitemapText('https://example.com', ['/', '/?a=1&b=2']);
  assert.equal(txt, 'https://example.com/\nhttps://example.com/?a=1&b=2\n');
  assert.throws(() => sitemapText('https://example.com', []));
});
