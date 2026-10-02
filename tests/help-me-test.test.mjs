import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { JSDOM, VirtualConsole } from 'jsdom';
import { filledTestPage, sampleTests, sampleSections, skillDir, templatePath } from './fill-test.mjs';
import { installFakeClaude } from './fake-claude.mjs';

const html = filledTestPage();
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const mineCount = sampleTests.filter((t) => sampleSections.find((s) => s.id === t.s).mine).length;

async function load(opts, { offline = false } = {}) {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', (e) => { if (e.type === 'unhandled-exception') errors.push(e); });
  let fake;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.test/page',
    virtualConsole,
    beforeParse(window) { if (!offline) fake = installFakeClaude(window, opts); },
  });
  await settle();
  const doc = dom.window.document;
  const $ = (id) => doc.getElementById(id);
  const type = (id, text) => { $(id).value = text; $(id).dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  return { dom, doc, $, type, fake, errors };
}
const mine = (fake, uid = 'u_me') => (fake.store.get('results/' + uid) || { tests: {} }).tests;
const events = (fake, uid = 'u_me') => (fake.store.get('audit/' + uid) || { events: [] }).events;
const noErrors = (errors) => assert.equal(errors.length, 0, 'page threw: ' + errors.map((e) => e.message).join(' | '));

test('help-me-test: filled page renders every test card with no error', async () => {
  const { doc, $, errors } = await load({}, { offline: true });
  noErrors(errors);
  assert.ok(!html.includes('{{'), 'placeholder left after filling');
  assert.equal(doc.querySelectorAll('.tc').length, sampleTests.length);
  assert.equal(doc.querySelectorAll('details.sec').length, sampleSections.length);
  assert.equal($('count').textContent, `0 of ${mineCount} done`);
  assert.ok($('banner').textContent.includes('Saving is not available'));
  for (const t of sampleTests) for (const s of ['pass', 'fail', 'blocked', 'skip']) assert.ok($(`${t.id}-${s}`), `#${t.id}-${s} missing`);
});

test('help-me-test: inline code and bold render as elements, not markup', async () => {
  const { doc } = await load({}, { offline: true });
  assert.ok(doc.querySelector('.steps code'), 'backticks should render as <code>');
  assert.ok(doc.querySelector('.steps strong'), '**bold** should render as <strong>');
  assert.ok(!doc.querySelector('.wrap').textContent.includes('**'), 'raw ** left in the page');
  assert.ok(doc.querySelector('#setup pre'), 'setup pre block missing');
});

test('help-me-test: check.mjs passes the filled page and fails the raw template', () => {
  const tmp = path.join(os.tmpdir(), 'hmt-filled.html');
  fs.writeFileSync(tmp, html);
  assert.equal(execFileSync('node', [skillDir + 'check.mjs', tmp], { encoding: 'utf8' }).trim(), 'OK');
  assert.throws(() => execFileSync('node', [skillDir + 'check.mjs', templatePath], { encoding: 'utf8', stdio: 'pipe' }));
});

test('help-me-test: Pass saves to my results doc, logs it and locks the card', async () => {
  const { $, fake, errors } = await load();
  $('t1-pass').click(); await settle();
  noErrors(errors);
  const r = mine(fake).t1;
  assert.equal(r.status, 'pass');
  assert.ok(r.rev.startsWith('e_'));
  const log = events(fake);
  assert.equal(log.length, 1);
  assert.equal(log[0].action, 'result');
  assert.equal(log[0].test, 't1');
  assert.equal(log[0].id, r.rev);
  assert.ok($('t1-fail').disabled, 'options must lock after save');
  assert.ok(!$('t1-change').hidden, 'Change result must show');
  assert.equal($('count').textContent, `1 of ${mineCount} done`);
});

test('help-me-test: Fail needs a note before Save works', async () => {
  const { $, type, fake } = await load();
  $('t2-fail').click(); await settle();
  assert.equal(fake.writes.length, 0, 'Fail must not save on tap');
  assert.ok(!$('t2-save').hidden);
  assert.ok($('t2-save').disabled, 'Save must wait for a note');
  type('t2-note', 'Bold button does nothing on Safari.'); await settle();
  assert.ok(!$('t2-save').disabled);
  $('t2-save').click(); await settle();
  assert.equal(mine(fake).t2.status, 'fail');
  assert.equal(mine(fake).t2.note, 'Bold button does nothing on Safari.');
});

test('help-me-test: two results keep each other in the one results doc', async () => {
  const { $, fake } = await load();
  $('t1-pass').click(); $('t2-skip').click(); await settle(20);
  assert.equal(mine(fake).t1.status, 'pass');
  assert.equal(mine(fake).t2.status, 'skip');
  assert.equal(events(fake).length, 2);
});

test('help-me-test: Change result logs from and to; Cancel restores', async () => {
  const { $, type, fake } = await load();
  $('t1-pass').click(); await settle();
  $('t1-change').click(); await settle();
  $('t1-skip').click(); await settle();
  $('t1-cancel').click(); await settle();
  assert.ok($('t1-pass').checked, 'Cancel must restore Pass');
  $('t1-change').click(); await settle();
  $('t1-blocked').click(); type('t1-note', 'Beta was down.'); await settle();
  $('t1-save').click(); await settle();
  const log = events(fake);
  assert.equal(log.length, 2);
  assert.equal(log[1].action, 'change');
  assert.equal(log[1].from.status, 'pass');
  assert.equal(log[1].to.status, 'blocked');
  assert.equal(mine(fake).t1.rev, log[1].id);
});

test("help-me-test: teammates' results show in the tally but do not lock my card", async () => {
  const seed = {
    'results/u_amy': { tests: { t1: { n: 1, status: 'fail', label: 'Fail', note: 'Slow.', at: 1 } } },
    'results/u_bo': { tests: { t1: { n: 1, status: 'pass', label: 'Pass', note: '', at: 2 } } },
  };
  const { $ } = await load({ seed, names: { u_amy: 'Amy', u_bo: 'Bo' } });
  await settle();
  assert.ok(!$('t1-pass').disabled, 'my card must stay open');
  assert.match($('t1-tally').textContent, /1 pass/);
  assert.match($('t1-tally').textContent, /1 fail/);
  const items = [...$('t1-team').querySelectorAll('li')].map((li) => li.textContent);
  assert.equal(items.length, 2);
  assert.match(items[0], /Fail Amy.*Slow/, 'failures list first, with the note');
  assert.match($('team').textContent, /from 2 testers/);
});

test('help-me-test: a save in another tab stops Save change', async () => {
  const { $, fake } = await load();
  $('t1-pass').click(); await settle();
  $('t1-change').click(); await settle();
  $('t1-skip').click(); await settle();
  fake.external('results/u_me', { tests: { t1: { n: 1, status: 'pass', label: 'Pass', note: 'other tab', at: 9, rev: 'e_other' } } }, { silent: true });
  $('t1-save').click(); await settle();
  assert.match($('t1-msg').textContent, /another tab/);
  assert.equal(mine(fake).t1.rev, 'e_other', 'must not overwrite the other tab');
});

test('help-me-test: cards stay read-only until results load', async () => {
  const { $, fake } = await load({ holdFirstSnapshot: true });
  assert.ok($('t1-pass').disabled);
  fake.release(); await settle();
  assert.ok(!$('t1-pass').disabled);
});

test('help-me-test: read-only viewer cannot save', async () => {
  const { $ } = await load({ canWrite: false });
  assert.ok($('t1-pass').disabled);
  assert.match($('banner').textContent, /Contributor/);
});

test('help-me-test: a refused save names the Contributor role', async () => {
  const { $, fake } = await load({ refuseWrites: 'results/' });
  $('t1-pass').click(); await settle();
  assert.match($('t1-msg').textContent, /Contributor/);
  assert.equal(events(fake).length, 0, 'nothing logged when the save fails');
});

test('help-me-test: ticking a part adds its tests to my count', async () => {
  const { dom, $ } = await load();
  const other = sampleSections.find((s) => !s.mine);
  const extra = sampleTests.filter((t) => t.s === other.id).length;
  $('pick-' + other.id).click(); $('pick-' + other.id).dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.equal($('count').textContent, `0 of ${mineCount + extra} done`);
});

test('help-me-test: two quick taps save once', async () => {
  const { $, fake } = await load();
  $('t1-pass').click(); $('t1-pass').click(); await settle(20);
  assert.equal(events(fake).length, 1);
});
