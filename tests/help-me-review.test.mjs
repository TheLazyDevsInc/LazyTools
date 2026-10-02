import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { JSDOM, VirtualConsole } from 'jsdom';
import { filledReviewPage, sampleItems, sampleAreas, skillDir, templatePath } from './fill-review.mjs';
import { installFakeClaude } from './fake-claude.mjs';

const html = filledReviewPage();
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const mineCount = sampleItems.filter((t) => sampleAreas.find((s) => s.id === t.s).mine).length;

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
const mine = (fake, uid = 'u_me') => (fake.store.get('reviews/' + uid) || { items: {} }).items;
const events = (fake, uid = 'u_me') => (fake.store.get('audit/' + uid) || { events: [] }).events;
const noErrors = (errors) => assert.equal(errors.length, 0, 'page threw: ' + errors.map((e) => e.message).join(' | '));

test('help-me-review: filled page renders every review card with no error', async () => {
  const { doc, $, errors } = await load({}, { offline: true });
  noErrors(errors);
  assert.ok(!html.includes('{{'), 'placeholder left after filling');
  assert.equal(doc.querySelectorAll('.tc').length, sampleItems.length);
  assert.equal(doc.querySelectorAll('details.sec').length, sampleAreas.length);
  assert.equal($('count').textContent, `0 of ${mineCount} reviewed`);
  assert.ok($('banner').textContent.includes('Saving is not available'));
  for (const t of sampleItems) for (const s of ['ok', 'fix', 'question', 'skip']) assert.ok($(`${t.id}-${s}`), `#${t.id}-${s} missing`);
});

test('help-me-review: inline code and bold render as elements, not markup', async () => {
  const { doc } = await load({}, { offline: true });
  assert.ok(doc.querySelector('.steps code'), 'backticks should render as <code>');
  assert.ok(doc.querySelector('.steps strong'), '**bold** should render as <strong>');
  assert.ok(!doc.querySelector('.wrap').textContent.includes('**'), 'raw ** left in the page');
  assert.ok(doc.querySelector('#setup pre'), 'setup pre block missing');
});

test('help-me-review: check.mjs passes the filled page and fails the raw template', () => {
  const tmp = path.join(os.tmpdir(), 'hmr-filled.html');
  fs.writeFileSync(tmp, html);
  assert.equal(execFileSync('node', [skillDir + 'check.mjs', tmp], { encoding: 'utf8' }).trim(), 'OK');
  assert.throws(() => execFileSync('node', [skillDir + 'check.mjs', templatePath], { encoding: 'utf8', stdio: 'pipe' }));
});

test('help-me-review: Looks good saves to my verdicts doc, logs it and locks the card', async () => {
  const { $, fake, errors } = await load();
  $('r1-ok').click(); await settle();
  noErrors(errors);
  const r = mine(fake).r1;
  assert.equal(r.status, 'ok');
  assert.ok(r.rev.startsWith('e_'));
  const log = events(fake);
  assert.equal(log.length, 1);
  assert.equal(log[0].action, 'verdict');
  assert.equal(log[0].item, 'r1');
  assert.equal(log[0].id, r.rev);
  assert.ok($('r1-fix').disabled, 'options must lock after save');
  assert.ok(!$('r1-change').hidden, 'Change verdict must show');
  assert.equal($('count').textContent, `1 of ${mineCount} reviewed`);
});

test('help-me-review: Change needed needs a note before Save works', async () => {
  const { $, type, fake } = await load();
  $('r2-fix').click(); await settle();
  assert.equal(fake.writes.length, 0, 'Change needed must not save on tap');
  assert.ok(!$('r2-save').hidden);
  assert.ok($('r2-save').disabled, 'Save must wait for a note');
  type('r2-note', 'Token comes from the folder id.'); await settle();
  assert.ok(!$('r2-save').disabled);
  $('r2-save').click(); await settle();
  assert.equal(mine(fake).r2.status, 'fix');
  assert.equal(mine(fake).r2.note, 'Token comes from the folder id.');
});

test('help-me-review: two verdicts keep each other in the one verdicts doc', async () => {
  const { $, fake } = await load();
  $('r1-ok').click(); $('r2-skip').click(); await settle(20);
  assert.equal(mine(fake).r1.status, 'ok');
  assert.equal(mine(fake).r2.status, 'skip');
  assert.equal(events(fake).length, 2);
});

test('help-me-review: Change verdict logs from and to; Cancel restores', async () => {
  const { $, type, fake } = await load();
  $('r1-ok').click(); await settle();
  $('r1-change').click(); await settle();
  $('r1-skip').click(); await settle();
  $('r1-cancel').click(); await settle();
  assert.ok($('r1-ok').checked, 'Cancel must restore Looks good');
  $('r1-change').click(); await settle();
  $('r1-question').click(); type('r1-note', 'Cannot tell from the diff.'); await settle();
  $('r1-save').click(); await settle();
  const log = events(fake);
  assert.equal(log.length, 2);
  assert.equal(log[1].action, 'change');
  assert.equal(log[1].from.status, 'ok');
  assert.equal(log[1].to.status, 'question');
  assert.equal(mine(fake).r1.rev, log[1].id);
});

test("help-me-review: teammates' verdicts show in the tally but do not lock my card", async () => {
  const seed = {
    'reviews/u_amy': { items: { r1: { n: 1, status: 'fix', label: 'Change needed', note: 'Slow.', at: 1 } } },
    'reviews/u_bo': { items: { r1: { n: 1, status: 'ok', label: 'Looks good', note: '', at: 2 } } },
  };
  const { $ } = await load({ seed, names: { u_amy: 'Amy', u_bo: 'Bo' } });
  await settle();
  assert.ok(!$('r1-ok').disabled, 'my card must stay open');
  assert.match($('r1-tally').textContent, /1 looks good/);
  assert.match($('r1-tally').textContent, /1 change needed/);
  const items = [...$('r1-team').querySelectorAll('li')].map((li) => li.textContent);
  assert.equal(items.length, 2);
  assert.match(items[0], /Change needed Amy.*Slow/, 'failures list first, with the note');
  assert.match($('team').textContent, /from 2 reviewers/);
});

test('help-me-review: a save in another tab stops Save change', async () => {
  const { $, fake } = await load();
  $('r1-ok').click(); await settle();
  $('r1-change').click(); await settle();
  $('r1-skip').click(); await settle();
  fake.external('reviews/u_me', { items: { r1: { n: 1, status: 'ok', label: 'Looks good', note: 'other tab', at: 9, rev: 'e_other' } } }, { silent: true });
  $('r1-save').click(); await settle();
  assert.match($('r1-msg').textContent, /another tab/);
  assert.equal(mine(fake).r1.rev, 'e_other', 'must not overwrite the other tab');
});

test('help-me-review: cards stay read-only until verdicts load', async () => {
  const { $, fake } = await load({ holdFirstSnapshot: true });
  assert.ok($('r1-ok').disabled);
  fake.release(); await settle();
  assert.ok(!$('r1-ok').disabled);
});

test('help-me-review: read-only viewer cannot save', async () => {
  const { $ } = await load({ canWrite: false });
  assert.ok($('r1-ok').disabled);
  assert.match($('banner').textContent, /Contributor/);
});

test('help-me-review: a refused save names the Contributor role', async () => {
  const { $, fake } = await load({ refuseWrites: 'reviews/' });
  $('r1-ok').click(); await settle();
  assert.match($('r1-msg').textContent, /Contributor/);
  assert.equal(events(fake).length, 0, 'nothing logged when the save fails');
});

test('help-me-review: ticking an area adds its items to my count', async () => {
  const { dom, $ } = await load();
  const other = sampleAreas.find((s) => !s.mine);
  const extra = sampleItems.filter((t) => t.s === other.id).length;
  $('pick-' + other.id).click(); $('pick-' + other.id).dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.equal($('count').textContent, `0 of ${mineCount + extra} reviewed`);
});

test('help-me-review: two quick taps save once', async () => {
  const { $, fake } = await load();
  $('r1-ok').click(); $('r1-ok').click(); await settle(20);
  assert.equal(events(fake).length, 1);
});

test('help-me-review: cards show severity and file reference, and check.mjs rejects a bad sev', async () => {
  const { doc } = await load({}, { offline: true });
  assert.ok(doc.querySelector('.sev-blocker'), 'blocker pill missing');
  assert.ok(doc.querySelector('code.ref'), 'file reference missing');
  const bad = html.replace("sev:'blocker'", "sev:'urgent'");
  const tmp = path.join(os.tmpdir(), 'hmr-bad.html');
  fs.writeFileSync(tmp, bad);
  assert.throws(() => execFileSync('node', [skillDir + 'check.mjs', tmp], { encoding: 'utf8', stdio: 'pipe' }));
});
