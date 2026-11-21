import test from 'node:test';
import assert from 'node:assert/strict';
import { landingPage } from './landingPage.ts';

const release = { version: '0.1.0', publishedAt: '2026-11-21T00:00:00Z', urls: { mac: 'https://github.com/x/y/AgentHub-mac.dmg', windows: 'https://github.com/x/y/AgentHub-windows-setup.exe' }, sizes: { mac: 120e6, windows: 90e6 } };

test('homepage links both downloads when a release exists', () => {
  const html = landingPage({ release, nonce: 'abc' });
  assert.match(html, /href="\/download\/mac"/);
  assert.match(html, /href="\/download\/windows"/);
  assert.match(html, /v0\.1\.0 · Apple silicon &amp; Intel · macOS 12\+ · 120 MB/);
  assert.match(html, /<script nonce="abc">/);
  assert.doesNotMatch(html, /coming soon/i);
});

test('homepage shows "coming soon" instead of broken links before the first release', () => {
  const html = landingPage({ release: null, nonce: 'abc' });
  assert.doesNotMatch(html, /href="\/download\//);
  assert.match(html, /macOS app coming soon/);
  assert.match(html, /aria-disabled="true"/);
});

test('release values are escaped', () => {
  const html = landingPage({ release: { ...release, version: '<script>x</script>' }, nonce: 'n' });
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});
