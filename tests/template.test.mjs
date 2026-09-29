import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { filledPage, sampleQ, totalParts } from './fill.mjs';

const html = filledPage();

const pageErrors = [];
let doc;

before(() => {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (err) => {
    if (err.type === 'unhandled-exception') pageErrors.push(err);
  });
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole });
  doc = dom.window.document;
});

test('template has no unfilled placeholders', () => {
  assert.ok(!html.includes('{{'), 'placeholder left after filling: ' + (html.match(/\{\{[^}]*\}\}/) || [''])[0]);
});

test('page script runs without an uncaught error', () => {
  assert.equal(pageErrors.length, 0,
    'page script threw: ' + pageErrors.map((e) => (e.detail && e.detail.message) || e.message).join(' | '));
});

test('every question renders a card', () => {
  assert.equal(doc.querySelectorAll('.qq').length, sampleQ.length, 'wrong number of .qq cards rendered');
});

test('counter starts at zero answered', () => {
  const count = doc.getElementById('count');
  assert.ok(count, '#count element missing');
  assert.equal(count.textContent.trim(), `0 of ${totalParts} answered`, '#count text is wrong');
});

test('offline banner is shown', () => {
  const banner = doc.getElementById('banner');
  assert.ok(banner, '#banner element missing');
  assert.ok(!banner.hidden, '#banner is hidden');
  assert.ok(banner.textContent.includes('Saving is not available'), '#banner text lacks "Saving is not available"');
});

test('each part has an Other text input and a note', () => {
  for (const q of sampleQ) {
    for (const p of q.parts) {
      assert.ok(doc.getElementById(p.id + '-othertext'), `#${p.id}-othertext missing`);
      assert.ok(doc.getElementById(p.id + '-note'), `#${p.id}-note missing`);
    }
  }
});

test('issue chips link to the issue', () => {
  const links = doc.querySelectorAll('.iss a');
  assert.equal(links.length, sampleQ.length, 'wrong number of issue links');
  assert.ok(links[0] && links[0].getAttribute('href').endsWith('41'), 'first issue link should end with 41, got ' + (links[0] && links[0].getAttribute('href')));
});
