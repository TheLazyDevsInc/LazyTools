import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { filledPage } from './fill.mjs';
import { installFakeClaude } from './fake-claude.mjs';

const html = filledPage();
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

async function load(opts) {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', (e) => { if (e.type === 'unhandled-exception') errors.push(e); });
  let fake;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    virtualConsole,
    beforeParse(window) { fake = installFakeClaude(window, opts); },
  });
  await settle();
  const doc = dom.window.document;
  const $ = (id) => doc.getElementById(id);
  const type = (id, text) => { $(id).value = text; $(id).dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  return { dom, doc, $, type, fake, errors };
}
const events = (fake, uid = 'u_me') => (fake.store.get('audit/' + uid) || { events: [] }).events;
const noErrors = (errors) => assert.equal(errors.length, 0, 'page threw: ' + errors.map((e) => e.message).join(' | '));

test('a tap saves the answer, logs it and locks the part', async () => {
  const { $, fake, errors } = await load();
  $('q1a-yes').click(); await settle();
  noErrors(errors);
  const a = fake.store.get('answers/q1a');
  assert.equal(a.choice, 'yes');
  assert.ok(a.rev && a.rev.startsWith('e_'), 'answers.rev must be an event id');
  const log = events(fake);
  assert.equal(log.length, 1);
  assert.equal(log[0].action, 'answer');
  assert.equal(log[0].id, a.rev);
  assert.equal(log[0].from, null);
  assert.equal(log[0].to.choice, 'yes');
  assert.ok($('q1a-no').disabled, 'options must be disabled when locked');
  assert.ok($('q1a-note').disabled, 'note must be disabled when locked');
  assert.ok(!$('q1a-change').hidden, 'Change answer must show when locked');
});

test('Change answer, then a tap, writes nothing; Cancel restores and locks', async () => {
  const { $, fake } = await load();
  $('q1a-yes').click(); await settle();
  const n = fake.writes.length;
  $('q1a-change').click(); await settle();
  assert.ok(!$('q1a-no').disabled, 'options must be enabled in change mode');
  $('q1a-no').click(); await settle();
  assert.equal(fake.writes.length, n, 'a tap in change mode must not save');
  $('q1a-cancel').click(); await settle();
  assert.ok($('q1a-yes').checked, 'Cancel must restore the saved choice');
  assert.ok($('q1a-no').disabled, 'Cancel must lock the part again');
  assert.equal(fake.writes.length, n);
});

test('Save change logs a change with from and to', async () => {
  const { $, fake } = await load();
  $('q1a-yes').click(); await settle();
  $('q1a-change').click(); await settle();
  $('q1a-no').click(); await settle();
  assert.equal($('q1a-save').textContent, 'Save change');
  assert.ok(!$('q1a-save').disabled);
  $('q1a-save').click(); await settle();
  const log = events(fake);
  assert.equal(log.length, 2);
  assert.equal(log[1].action, 'change');
  assert.equal(log[1].from.choice, 'yes');
  assert.equal(log[1].to.choice, 'no');
  assert.equal(fake.store.get('answers/q1a').rev, log[1].id);
  assert.ok($('q1a-yes').disabled, 'the part must lock after Save change');
});

test('a note-only edit is logged as a change', async () => {
  const { $, type, fake } = await load();
  $('q1a-yes').click(); await settle();
  $('q1a-change').click(); await settle();
  type('q1a-note', 'Only on weekdays');
  $('q1a-save').click(); await settle();
  const log = events(fake);
  assert.equal(log[1].action, 'change');
  assert.equal(log[1].from.note, '');
  assert.equal(log[1].to.note, 'Only on weekdays');
  const items = [...$('q1a-hist').querySelectorAll('li')].map((li) => li.textContent);
  assert.ok(items[1].includes('edited the note'), 'history line: ' + items[1]);
});

test('Other does not save until Save, and Save needs text', async () => {
  const { $, type, fake } = await load();
  $('q2a-other').click(); await settle();
  assert.ok(!fake.store.has('answers/q2a'), 'picking Other must not save');
  assert.ok(!$('q2a-save').hidden, 'Save must show for Other');
  assert.ok($('q2a-save').disabled, 'Save must be disabled with empty text');
  type('q2a-othertext', 'Next quarter');
  assert.ok(!$('q2a-save').disabled);
  $('q2a-save').click(); await settle();
  assert.equal(fake.store.get('answers/q2a').other, 'Next quarter');
  assert.equal(events(fake)[0].to.other, 'Next quarter');
});

test('Save change stops if a teammate saved after change mode opened', async () => {
  const { $, fake } = await load();
  $('q1a-yes').click(); await settle();
  $('q1a-change').click(); await settle();
  const a = fake.store.get('answers/q1a');
  fake.external('answers/q1a', { ...a, choice: 'no', label: 'No, notify and wait.', rev: 'e_teammate', by: 'u_pat' }, { silent: true });
  $('q1a-no').click(); await settle();
  $('q1a-save').click(); await settle();
  assert.ok($('q1a-msg').textContent.includes('changed this answer while you were editing'), 'msg: ' + $('q1a-msg').textContent);
  assert.equal(events(fake).length, 1, 'no change event may be written');
  assert.equal(fake.store.get('answers/q1a').rev, 'e_teammate', 'the teammate answer must stay');
  assert.ok(!$('q1a-cancel').hidden, 'the part must stay in change mode');
});

test('read-only viewer sees no Change button and disabled options', async () => {
  const seed = { 'answers/q1a': { n: 1, part: 'q1a', choice: 'yes', label: 'Yes, retry automatically.', other: '', note: '', by: 'u_pat', at: 1000, viaDefault: false, rev: 'e_1' } };
  const { $ } = await load({ canWrite: false, seed });
  assert.ok($('q1a-no').disabled);
  assert.ok($('q1b-three').disabled, 'open parts are also read-only');
  assert.ok($('q1a-change').hidden);
});

test('the default button logs default events only for open parts', async () => {
  const { $, fake } = await load();
  $('q1a-no').click(); await settle();
  $('accdef').click(); await settle(16);
  assert.equal(fake.store.get('answers/q1a').choice, 'no', 'a locked part must not change');
  assert.equal(fake.store.get('answers/q1b').choice, 'three');
  assert.equal(fake.store.get('answers/q1b').viaDefault, true);
  assert.ok(!fake.store.has('answers/q2a'), 'q2a has no default and is in a group without defaults');
  const log = events(fake);
  assert.deepEqual(log.map((e) => e.action), ['answer', 'default']);
});

test('history shows two people in time order', async () => {
  const seed = {
    'answers/q1b': { n: 1, part: 'q1b', choice: 'one', label: 'Retry only once.', other: '', note: '', by: 'u_pat', at: 1000, viaDefault: false, rev: 'e_1' },
    'audit/u_pat': { events: [{ id: 'e_1', part: 'q1b', n: 1, action: 'answer', from: null, to: { choice: 'one', label: 'Retry only once.', other: '', note: '' }, at: 1000 }] },
  };
  const { $ } = await load({ seed, names: { u_pat: 'Pat', u_me: 'Me' } });
  $('q1b-change').click(); await settle();
  $('q1b-three').click(); await settle();
  $('q1b-save').click(); await settle();
  const items = [...$('q1b-hist').querySelectorAll('li')].map((li) => li.textContent);
  assert.equal(items.length, 2);
  assert.ok(items[0].startsWith('Pat chose “Retry only once.”'), items[0]);
  assert.ok(items[1].startsWith('Me changed “Retry only once.” → “Retry up to 3 times.”'), items[1]);
  assert.ok($('q1b-hist').querySelector('summary').textContent === 'History (2)');
  assert.ok($('q1b-hist').closest('.part').querySelector('.who').textContent.includes('changed 1×'));
});

// Review Focus

test('two quick taps save once', async () => {
  const { $, fake } = await load();
  $('q1a-yes').click();
  $('q1a-no').click();
  await settle();
  const answerWrites = fake.writes.filter((w) => w.path === 'answers/q1a');
  assert.equal(answerWrites.length, 1);
  assert.equal(events(fake).length, 1);
});

test('no user id: answer saves, log warning shows', async () => {
  const { $, fake, errors } = await load({ uid: null });
  $('q1a-yes').click(); await settle();
  noErrors(errors);
  assert.equal(fake.store.get('answers/q1a').choice, 'yes');
  assert.ok(![...fake.store.keys()].some((k) => k.startsWith('audit/')), 'nothing may be written under audit/');
  assert.ok(!$('logwarn').hidden, 'the log warning must show');
});

test('failed log write can be retried', async () => {
  const { $, fake } = await load({ failAudit: 2 });
  $('q1a-yes').click(); await settle();
  assert.equal(fake.store.get('answers/q1a').choice, 'yes');
  assert.ok(!$('logwarn').hidden);
  $('retrylog').click(); await settle();
  assert.equal(events(fake).length, 1);
  assert.ok($('logwarn').hidden);
});

test('Other with empty text does not save a change', async () => {
  const { $, fake } = await load();
  $('q1a-yes').click(); await settle();
  $('q1a-change').click(); await settle();
  $('q1a-other').click(); await settle();
  $('q1a-save').click(); await settle();
  assert.equal(events(fake).length, 1);
  assert.ok($('q1a-msg').textContent.includes('Type your answer'), 'msg: ' + $('q1a-msg').textContent);
});

test("a teammate's answer locks an open part", async () => {
  const { $, fake } = await load();
  fake.external('answers/q1a', { n: 1, part: 'q1a', choice: 'no', label: 'No, notify and wait.', other: '', note: '', by: 'u_pat', at: 2000, viaDefault: false, rev: 'e_x' });
  await settle();
  assert.ok($('q1a-no').checked);
  assert.ok($('q1a-yes').disabled);
  assert.ok(!$('q1a-change').hidden);
  assert.ok($('q1a-cancel').hidden, 'change mode must not open by itself');
});

test('other text is not saved with a normal option', async () => {
  const { $, fake, type } = await load();
  type('q1a-othertext', 'stale');
  $('q1a-yes').click(); await settle();
  const a = fake.store.get('answers/q1a');
  assert.equal(a.other, '', 'answer.other must be empty when a normal option is saved');
  const log = events(fake);
  assert.equal(log[0].to.other, '', 'logged event.to.other must be empty');
});

test('Cancel is disabled while Save change runs, so it cannot race the save', async () => {
  const { $, fake, errors } = await load();
  $('q1a-yes').click(); await settle();
  const n = fake.writes.length;
  $('q1a-change').click(); await settle();
  $('q1a-no').click(); await settle();
  $('q1a-save').click();
  assert.ok($('q1a-cancel').disabled, 'Cancel must be disabled while saving');
  assert.ok($('q1a-save').disabled, 'Save must be disabled while saving');
  $('q1a-cancel').click();
  await settle();
  noErrors(errors);
  assert.equal(events(fake).length, 2, 'the save completes and logs once');
  assert.equal(fake.store.get('answers/q1a').choice, 'no', 'the save wins; Cancel was ignored');
  assert.ok($('q1a-yes').disabled, 'the part must be locked after the save');
});

test('arrow keys select without saving', async () => {
  const { $, dom, fake } = await load();
  $('q1b-three').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  $('q1b-three').checked = true;
  $('q1b-three').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await settle();
  assert.equal(fake.store.get('answers/q1b'), undefined, 'arrow key selection must not save');
  assert.ok(!$('q1b-save').hidden, 'Save button must show after keyboard selection');
  assert.ok(!$('q1b-save').disabled, 'Save button must be enabled after keyboard selection');
  $('q1b-save').click(); await settle();
  assert.equal(fake.store.get('answers/q1b').choice, 'three', 'explicit Save must save the keyboard-selected choice');
});

test('an arrow key in the Other box does not block a later tap', async () => {
  const { $, dom, fake } = await load();
  $('q1a-othertext').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await settle();
  $('q1a-yes').click(); await settle();
  assert.equal(fake.store.get('answers/q1a').choice, 'yes', 'arrow key in Other box must not block tap on normal option');
});

test('an arrow key with no change does not block a later tap', async () => {
  const { $, dom, fake } = await load();
  $('q1a-yes').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await settle();
  $('q1a-no').click(); await settle();
  assert.equal(fake.store.get('answers/q1a').choice, 'no', 'arrow key with no change must not block later tap');
});

// Final review fixes

test('parts stay read-only until saved answers load', async () => {
  const seed = { 'answers/q1a': { n: 1, part: 'q1a', choice: 'yes', label: 'Yes, retry automatically.', other: '', note: '', by: 'u_pat', at: 1000, viaDefault: false, rev: 'e_1' } };
  const { $, fake } = await load({ seed, holdFirstSnapshot: true });
  assert.ok($('q1a-yes').disabled, 'q1a must be read-only before load');
  assert.ok($('q1b-three').disabled, 'q1b must be read-only before load');
  assert.ok($('accdef').disabled, 'default button must be disabled before load');
  $('q1b-three').click(); await settle();
  assert.equal(fake.writes.length, 0, 'no write before answers load');
  fake.release(); await settle();
  assert.ok(!$('q1a-change').hidden, 'locked part must show Change answer');
  assert.ok(!$('q1b-three').disabled, 'open part must be enabled after load');
  assert.ok(!$('accdef').disabled, 'default button must be enabled after load');
});

test('a save keeps earlier log entries when the log has not loaded', async () => {
  const old = { id: 'e_old', part: 'q1b', n: 1, action: 'answer', from: null, to: { choice: 'one', label: 'Retry only once.', other: '', note: '' }, at: 500 };
  const seed = { 'audit/u_me': { events: [old] } };
  const { $, fake } = await load({ seed, holdFirstSnapshot: true });
  fake.release('answers'); await settle();
  $('q1a-yes').click(); await settle();
  const ids = events(fake).map((e) => e.id);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], 'e_old');
  assert.equal(ids[1], fake.store.get('answers/q1a').rev);
});

test('double click on the default button logs each default once', async () => {
  const { $, fake } = await load();
  $('accdef').click();
  $('accdef').click();
  await settle(16);
  for (const pid of ['q1a', 'q1b']) {
    assert.equal(events(fake).filter((e) => e.part === pid && e.action === 'default').length, 1, pid + ' default events');
    assert.equal(fake.writes.filter((w) => w.path === 'answers/' + pid).length, 1, pid + ' answer writes');
  }
});

test('a refused save names the Contributor role', async () => {
  const { $, fake, errors } = await load({ canWrite: null, refuseAnswerWrites: true });
  $('q1a-yes').click(); await settle();
  noErrors(errors);
  const msgText = $('q1a-msg').textContent;
  assert.ok(msgText.includes('Contributor or Editor'), 'msg should name Contributor: ' + msgText);
  assert.ok(msgText.includes('invalid_argument'), 'msg should include error code: ' + msgText);
  assert.ok(!fake.store.has('answers/q1a'), 'no answer should be saved');
});
