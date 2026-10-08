import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { JSDOM, VirtualConsole } from 'jsdom';
import { filledCatchupPage, sampleStory, sampleState, sampleOptions, sampleCaveats, skillDir, templatePath } from './fill-catchme.mjs';

const html = filledCatchupPage();
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

async function load({ clipboard } = {}) {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', (e) => { if (e.type === 'unhandled-exception') errors.push(e); });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.test/page',
    virtualConsole,
    beforeParse(window) {
      if (clipboard === 'ok') {
        window.__copied = [];
        Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true });
      } else if (clipboard === 'denied') {
        Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
      }
    },
  });
  await settle();
  const doc = dom.window.document;
  return { dom, doc, $: (id) => doc.getElementById(id), errors };
}
const noErrors = (errors) => assert.equal(errors.length, 0, 'page threw: ' + errors.map((e) => e.message).join(' | '));

test('catch-me-up: filled page renders story, state, options and caveats with no error', async () => {
  const { doc, $, errors } = await load();
  noErrors(errors);
  assert.ok(!html.includes('{{'), 'placeholder left after filling');
  assert.equal(doc.querySelectorAll('#story li').length, sampleStory.length);
  assert.equal(doc.querySelectorAll('#state .col').length, sampleState.filter((g) => g.items.length).length);
  assert.equal(doc.querySelectorAll('.opt').length, sampleOptions.length);
  assert.equal(doc.querySelectorAll('.opt.rec').length, 1);
  assert.equal($('caveats').hidden, false);
  assert.equal(doc.querySelectorAll('#caveatbox li').length, sampleCaveats.length);
});

test('catch-me-up: inline code and bold render as elements, not markup', async () => {
  const { doc } = await load();
  assert.ok(doc.querySelector('#now code'), 'backticks should render as <code>');
  assert.ok(doc.querySelector('#state strong'), '**bold** should render as <strong>');
  assert.ok(!doc.querySelector('.wrap').textContent.includes('**'), 'raw ** left in the page');
});

test('catch-me-up: the page has no way to save, so it asks for no capabilities', () => {
  assert.ok(!/window\.claude|ArtifactData|\.db\b/.test(html), 'page must stay read-only');
});

test('catch-me-up: check.mjs passes the filled page and fails the raw template', () => {
  const tmp = path.join(os.tmpdir(), 'hmcu-filled.html');
  fs.writeFileSync(tmp, html);
  assert.equal(execFileSync('node', [skillDir + 'check.mjs', tmp], { encoding: 'utf8' }).trim(), 'OK');
  assert.throws(() => execFileSync('node', [skillDir + 'check.mjs', templatePath], { encoding: 'utf8', stdio: 'pipe' }));
});

test('catch-me-up: check.mjs rejects a missing or doubled recommendation and a bad option id', () => {
  const run = (mutate) => {
    const tmp = path.join(os.tmpdir(), 'hmcu-bad.html');
    fs.writeFileSync(tmp, mutate(html));
    try { execFileSync('node', [skillDir + 'check.mjs', tmp], { encoding: 'utf8', stdio: 'pipe' }); return ''; }
    catch (e) { return String(e.stdout); }
  };
  assert.match(run((h) => h.replace('{id:\'a\',rec:1,', '{id:\'a\',')), /exactly one option/);
  assert.match(run((h) => h.replace('{id:\'b\',', '{id:\'b\',rec:1,')), /exactly one option/);
  assert.match(run((h) => h.replace("{id:'c',", "{id:'d',")), /must be a, b or c/);
});

test('catch-me-up: Copy puts the option prompt on the clipboard', async () => {
  const { dom, $, errors } = await load({ clipboard: 'ok' });
  $('copy-a').click(); await settle();
  noErrors(errors);
  assert.deepEqual(dom.window.__copied, [sampleOptions[0].prompt]);
  assert.match($('note-a').textContent, /Copied/);
});

test('catch-me-up: Copy says so when the clipboard is blocked, and does not throw', async () => {
  for (const mode of ['denied', 'none']) {
    const { $, errors } = await load({ clipboard: mode });
    $('copy-b').click(); await settle();
    noErrors(errors);
    assert.match($('note-b').textContent, /Could not copy/);
  }
});
