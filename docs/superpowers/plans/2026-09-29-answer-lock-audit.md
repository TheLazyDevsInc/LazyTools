# Answer Lock and Change Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Saved answers on the help-me-decide page lock. A change needs Change answer, then Save change. Every save is logged per person at `audit/<person id>`, and Phase 2 shows the changes in the ADR.

**Architecture:** All page logic stays in the single inline script of `template.html`, in the same ES5-with-`async` style it uses today. Each part has a state (`open`, `locked`, `changing`, `ro`) computed from `answers`, `editing` and access. A save writes `answers/<part>` first, then appends one event to the person's own `audit/<id>` document. Tests run the page in jsdom with a fake `window.claude` that keeps data in memory.

**Tech Stack:** plain HTML/CSS/JS page (Artifact runtime contract 0.2.63, `db` and `user` capabilities), Node `node:test`, jsdom 30.1.1.

**Spec:** `docs/superpowers/specs/2026-09-29-answer-lock-audit-design.md` (decision record: `docs/adr/0001-lock-answers-and-log-changes.md`)

## Global Constraints

- Node `>=22.22.2`; jsdom pinned at `30.1.1`; no new dependencies.
- Page code: `var` and `function` style like the rest of `template.html`; `async`/`await` is allowed (the template already uses it). No external scripts.
- Set all page text with `textContent`, never `innerHTML`.
- Access rules, verbatim: `{ "path": "audit", "read": "view", "write": "owner" }` and `{ "path": "audit/{self}", "write": "interact" }`.
- Publish capabilities, verbatim: `{"db": {"rules": [{"path": "audit", "read": "view", "write": "owner"}, {"path": "audit/{self}", "write": "interact"}]}, "user": {"scopes": ["profile"]}}`.
- Never put an email on the page or in the ADR. Name only; add the first 6 characters of the id if two people share a name.
- The `Q` data shape does not change. `check.mjs` does not change.
- Page and docs copy: plain short sentences (ASD-STE100 style). Button labels exactly: `Save`, `Change answer`, `Save change`, `Cancel`, `Retry log`.
- Subagents edit with Edit/Write only. No `git checkout`, `stash`, `reset`, `restore` inside a subagent. The controller commits.
- The offline path (no `window.claude`) must still pass the 7 existing tests in `tests/template.test.mjs`.

## Review Focus

1. **Two quick taps before the first save returns** → only one answer is saved and one event is logged (`busy` guard). Test: Task 2, "two quick taps save once".
2. **No user id** (the `user` capability is missing or `id()` gives null) → the answer still saves, the log warning shows, nothing is written to `audit/null`. Test: Task 2, "no user id: answer saves, log warning shows".
3. **The log write fails** → the answer stays saved, "Retry log" shows, and Retry writes the kept event. Test: Task 2, "failed log write can be retried".
4. **In change mode the person picks Other and leaves the text empty** → Save change does not save and asks for text. Test: Task 2, "Other with empty text does not save a change".
5. **A teammate answers an open part** → the part locks with the teammate's answer and no Change mode opens by itself. Test: Task 2, "a teammate's answer locks an open part".

---

### Task 1: Check the access rules on the real store (controller only)

No code is kept. The controller does this with the Artifact and ArtifactData tools, because subagents cannot publish.

**Files:**
- Create (scratchpad only): `<scratchpad>/rules-probe.html`

**Interfaces:**
- Produces: a yes/no answer for each check below. If any check fails, stop and revise the spec before Task 2.

- [x] **Step 1: Write the probe page**

```html
<title>Rules Probe</title>
<style>:root{--bg:#fff;--fg:#111}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111;--fg:#eee;color-scheme:dark}}:root[data-theme="dark"]{--bg:#111;--fg:#eee;color-scheme:dark}body{background:var(--bg);color:var(--fg);padding-inline:16px}</style>
<p>Probe page for access rules. Safe to delete.</p>
```

- [x] **Step 2: Publish it with the rules**

Artifact `publish`, `file_path` = the probe, `icon` = `lock`, `capabilities` = the Global Constraints publish capabilities.

- [x] **Step 3: Run the four checks with ArtifactData**

Owner id: `u_9AFlzxNDwCwLuTh2tE0Ybw` (from the earlier answers).
- (a) `set`, `collection: audit`, `doc_id: u_9AFlzxNDwCwLuTh2tE0Ybw`, `data: {"events": []}`, `as_level: interact` → expected: success.
- (b) `set`, `collection: audit`, `doc_id: u_AAAAAAAAAAAAAAAAAAAAAA`, `data: {"events": []}`, `as_level: interact` → expected: refused.
- (c) `list`, `collection: audit`, `as_level: view` → expected: shows the doc from (a).
- (d) `list`, `collection: audit` (no `as_level`) → expected: shows the doc from (a).

- [x] **Step 4: Clean up and record**

`delete` the doc from (a), passing its `version` as `if_version`. Add the four results to `docs/LEARNINGS.md` only if one surprised us (via a Haiku subagent). Delete the probe artifact only if the user asks.

---

### Task 2: Shared page fill, fake `window.claude`, and the failing lock tests

**Files:**
- Create: `tests/fill.mjs`
- Create: `tests/fake-claude.mjs`
- Create: `tests/lock.test.mjs`
- Modify: `tests/template.test.mjs` (top part only: use `tests/fill.mjs`)

**Interfaces:**
- Produces: `filledPage(): string`, `sampleQ: Array`, `totalParts: number`, `templatePath: string` from `tests/fill.mjs`.
- Produces: `installFakeClaude(window, {uid, canWrite, names, seed, failAudit}) → {store: Map<path, object>, writes: Array<{path, data}>, external(path, data, {silent}): void}` from `tests/fake-claude.mjs`.
- Consumes (from Task 3, page DOM ids per part id `P`): radios `#P-<optId>` and `#P-other`, `#P-othertext`, `#P-note`, buttons `#P-save`, `#P-change`, `#P-cancel`, status `#P-msg`, history `details#P-hist` with `summary` and `ol > li`, global `#logwarn` and `#retrylog`, and `.who` inside each part.

- [x] **Step 1: Create `tests/fill.mjs`**

```js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const skillDir = fileURLToPath(new URL('../plugins/lazytools/skills/help-me-decide/', import.meta.url));
export const templatePath = process.env.TEMPLATE || skillDir + 'template.html';

const Q_BLOCK = /var Q=\[[\s\S]*?\n\s*\];/;
const sample = fs.readFileSync(skillDir + 'examples/sample-questions.md', 'utf8');
const sampleBlock = sample.match(Q_BLOCK)[0];
export const sampleQ = new Function(sampleBlock.replace(/^var Q=/, 'return ').replace(/;$/, ''))();
export const totalParts = sampleQ.reduce((n, q) => n + q.parts.length, 0);

const values = {
  TITLE: 'Test title',
  EYEBROW: 'Test eyebrow',
  LEDE: 'Test lede.',
  DEADLINE: 'Fri 9 Oct 2026',
  DECIDED_ROWS: 'None decided yet.',
  SOURCE_LINE: 'Test source line.',
  ISSUE_BASE: 'https://github.com/OWNER/REPO/issues/',
  TIMEZONE: 'Asia/Kolkata',
  TZ_LABEL: 'IST',
  LOCALE: 'en-IN',
};

export function filledPage() {
  let html = fs.readFileSync(templatePath, 'utf8');
  if (!Q_BLOCK.test(html)) throw new Error('template has no var Q=[...]; block to replace');
  html = html.replace(Q_BLOCK, () => sampleBlock);
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (m, name) => (name in values ? values[name] : m));
}
```

- [x] **Step 2: Point `tests/template.test.mjs` at `fill.mjs`**

Replace everything from the first line down to and including the line `html = html.replace(/\{\{([A-Z_]+)\}\}/g, (m, name) => (name in values ? values[name] : m));` with:

```js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { filledPage, sampleQ, totalParts } from './fill.mjs';

const html = filledPage();
```

Leave the rest of the file (the `pageErrors`, `before()` and the 7 tests) unchanged.

- [x] **Step 3: Run the old tests to prove the refactor changed nothing**

Run: `npm test`
Expected: `pass 7`, `fail 0`.

- [x] **Step 4: Create `tests/fake-claude.mjs`**

```js
// In-memory stand-in for the Artifact runtime: claude.use('db') and claude.use('user').
export function installFakeClaude(window, { uid = 'u_me', canWrite = true, names = {}, seed = {}, failAudit = 0 } = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, structuredClone(v)]));
  const writes = [];
  const subs = [];
  let auditFailures = failAudit;
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = (path) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => store.get(path), metadata: meta });
  const emit = () => {
    for (const s of subs) {
      const docs = [...store.keys()]
        .filter((k) => k.split('/').length === 2 && k.startsWith(s.coll + '/'))
        .sort()
        .map(snapDoc);
      s.fn({ docs, size: docs.length, empty: docs.length === 0, docChanges: () => [], metadata: meta });
    }
  };
  const db = {
    doc(path) {
      return {
        id: path.split('/').pop(),
        path,
        async get() { return snapDoc(path); },
        async set(data) {
          if (path.startsWith('audit/') && auditFailures > 0) {
            auditFailures--;
            throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
          }
          const body = structuredClone(data);
          store.set(path, body);
          writes.push({ path, data: body });
          emit();
        },
      };
    },
    collection(coll) {
      return {
        path: coll,
        onSnapshot(fn) { subs.push({ coll, fn }); queueMicrotask(emit); return () => {}; },
      };
    },
  };
  const user = {
    id: async () => uid,
    can: async () => canWrite,
    profiles: async (ids) => Object.fromEntries(ids.map((i) => [i, { name: names[i] || '' }])),
  };
  window.claude = { use: async (name) => (name === 'db' ? db : name === 'user' ? user : null) };
  return {
    store,
    writes,
    // A teammate's write that bypasses this page. silent: the page gets no snapshot.
    external(path, data, { silent = false } = {}) {
      store.set(path, structuredClone(data));
      if (!silent) emit();
    },
  };
}
```

- [x] **Step 5: Create `tests/lock.test.mjs` with all lock, log and Review Focus tests**

```js
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
```

- [x] **Step 6: Run the tests to prove they fail (red)**

Run: `npm test`
Expected: the 7 tests in `template.test.mjs` pass; every test in `lock.test.mjs` fails (for example `q1a-change` is null, or no `audit/` write).

- [x] **Step 7: Commit (controller)**

```bash
git add tests/fill.mjs tests/fake-claude.mjs tests/lock.test.mjs tests/template.test.mjs
git commit -m "test(help-me-decide): failing tests for answer lock and change log"
```

---

### Task 3: Implement lock, change mode and the per-person log in `template.html`

**Files:**
- Modify: `plugins/lazytools/skills/help-me-decide/template.html` (CSS block, the `.askbar .sub` text, one new element after `#banner`, and the script from `var $=` to the end of the IIFE)
- Test: `tests/lock.test.mjs`, `tests/template.test.mjs`

**Interfaces:**
- Consumes: the DOM ids listed in Task 2's Interfaces (this task creates them).
- Produces: `answers/<part>` bodies with `rev`; `audit/<uid>` bodies `{events: [...]}`; event shape `{id, part, n, action, from, to, at}` as in the spec.

- [x] **Step 1: Add CSS**

Add these rules at the end of the `<style>` block, just before `</style>`:

```css
.btn:disabled{opacity:.5;cursor:not-allowed;filter:none}
.pbar{display:flex;flex-wrap:wrap;gap:8px}
.pbar .btn{min-height:40px;padding:10px 14px}
.opt:has(input:disabled){cursor:default}
.opt:has(input:disabled):hover{border-color:var(--line)}
.opt.sel:has(input:disabled):hover{border-color:var(--ok)}
.pmsg{font-size:14px;color:var(--chg);font-weight:700}
.pmsg:empty{display:none}
.hist{font-size:14px;color:var(--muted)}
.hist summary{cursor:pointer;font-weight:700}
.hist ol{margin:6px 0 0;padding-left:20px;display:grid;gap:4px}
```

- [x] **Step 2: Change the help line and add the log warning element**

Replace the `.askbar` `<span class="sub">` text with:
`Tap a choice to save and lock it. To change it later, press Change answer. Type a note before you tap if a choice needs a detail.`

Directly after `<div id="banner" hidden></div>` add:

```html
  <div id="logwarn" class="banner warn" hidden>
    <span>Answer saved, but the change log entry failed.</span>
    <button class="btn ghost" id="retrylog" type="button">Retry log</button>
  </div>
```

- [x] **Step 3: Replace the script body**

In the `<script>`, keep `var ISSUE_BASE=...`, `var GROUPS=[...]` and `var Q=[...]` (with their comments) exactly as they are. Replace everything from `var $=function(i){...}` down to, but not including, the final `})();` of the IIFE with:

```js
  var $=function(i){return document.getElementById(i);};
  var db=null,user=null,uid=null,readOnly=false;
  var answers={},audits={},names={},parts={},editing={},busy={},unlogged=[];
  var logQueue=Promise.resolve();
  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  function btn(id,cls,text){var b=el('button','btn'+(cls?' '+cls:''),text);b.type='button';b.id=id;b.hidden=true;return b;}
  var groupOf={};GROUPS.forEach(function(g){groupOf[g.id]=g;});

  function build(){
    var box=$('groups');
    GROUPS.forEach(function(g){
      var wrap=el('div','qgroup');
      var h=el('h3',null,g.title+' ');h.appendChild(el('span','pill '+g.cls,g.pill));
      var list=el('div','qgroup');list.id='grp-'+g.id;
      wrap.appendChild(h);wrap.appendChild(list);box.appendChild(wrap);
    });
    Q.forEach(function(q){
      var card=el('div','qq');card.id='card'+q.n;$('grp-'+q.g).appendChild(card);
      var head=el('div','qhead');
      head.appendChild(el('span','qn','Q'+q.n));
      head.appendChild(el('span','iss',q.iss));
      card.appendChild(head);
      card.appendChild(el('p','ask-text',q.text));
      if(q.why)card.appendChild(el('p','why',q.why));
      q.parts.forEach(function(p){
        var wrap=el('div','part');
        if(p.t)wrap.appendChild(el('p','ptext',p.t));
        var fs=el('fieldset','opts');fs.setAttribute('aria-label','Q'+q.n+' '+(p.t||q.text));
        var opts=p.opts.concat([{id:'other',l:'Other',other:1}]);
        var defId=null;
        opts.forEach(function(o){
          var lab=el('label','opt');
          var r=document.createElement('input');r.type='radio';r.name=p.id;r.value=o.id;r.id=p.id+'-'+o.id;
          var box2=el('span','lbl');
          box2.appendChild(el('span',null,o.l));
          if(o.d){defId=o.id;box2.appendChild(el('span','tag','Default if no answer'));}
          if(o.other){var ot=document.createElement('input');ot.type='text';ot.className='txt';ot.id=p.id+'-othertext';ot.placeholder='Type your answer';ot.setAttribute('aria-label','Other answer');box2.appendChild(ot);}
          lab.appendChild(r);lab.appendChild(box2);fs.appendChild(lab);
        });
        wrap.appendChild(fs);
        var note=document.createElement('textarea');note.className='txt';note.id=p.id+'-note';note.rows=2;note.placeholder='Note (optional)';note.setAttribute('aria-label','Note');
        wrap.appendChild(note);
        var bar=el('div','pbar');
        bar.appendChild(btn(p.id+'-save','','Save'));
        bar.appendChild(btn(p.id+'-change','ghost','Change answer'));
        bar.appendChild(btn(p.id+'-cancel','ghost','Cancel'));
        wrap.appendChild(bar);
        var who=el('span','who','');who.setAttribute('aria-live','polite');wrap.appendChild(who);
        var m=el('span','pmsg','');m.id=p.id+'-msg';m.setAttribute('role','status');wrap.appendChild(m);
        var hist=el('details','hist');hist.id=p.id+'-hist';hist.hidden=true;
        hist.appendChild(el('summary',null,'History (0)'));hist.appendChild(el('ol'));
        wrap.appendChild(hist);
        card.appendChild(wrap);
        parts[p.id]={q:q,p:p,defId:defId,el:wrap};
        fs.addEventListener('change',function(ev){if(ev.target&&ev.target.type==='radio')onPick(p.id,ev.target.value);});
        $(p.id+'-othertext').addEventListener('input',function(){paint();});
        note.addEventListener('input',function(){paint();});
        $(p.id+'-save').addEventListener('click',function(){commit(p.id,state(p.id)==='changing'?'change':'answer');});
        $(p.id+'-change').addEventListener('click',function(){startChange(p.id);});
        $(p.id+'-cancel').addEventListener('click',function(){cancelChange(p.id);});
      });
      if(q.parts.every(function(p){return p.nodef;}))card.appendChild(el('p','nodef','No default. We wait for your answer.'));
    });
  }

  function state(pid){
    if(readOnly||!db)return 'ro';
    if(editing[pid])return 'changing';
    var a=answers[pid];return a&&a.choice?'locked':'open';
  }
  function snap(a){a=a||{};return {choice:a.choice||'',label:a.label||'',other:a.other||'',note:a.note||''};}
  function same(a,b){return a.choice===b.choice&&a.other===b.other&&a.note===b.note;}
  function collect(pid){
    var c=parts[pid].el.querySelector('input[type=radio]:checked');
    var choice=c?c.value:'',label='';
    if(c){var lb=c.parentNode.querySelector('.lbl span');label=lb?lb.textContent:'';}
    return {choice:choice,label:label,other:$(pid+'-othertext').value.trim(),note:$(pid+'-note').value.trim()};
  }
  function fill(pid,a){
    var s=snap(a);
    parts[pid].el.querySelectorAll('input[type=radio]').forEach(function(r){r.checked=(r.value===s.choice);});
    $(pid+'-othertext').value=s.other;$(pid+'-note').value=s.note;
  }
  function msg(pid,t){$(pid+'-msg').textContent=t;}
  function nameOf(id){return (id&&names[id])||'Someone';}
  function newId(){return 'e_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
  function errCode(e){return e&&e.code?e.code:'error';}
  function banner(kind,text){var b=$('banner');b.className='banner '+kind;b.textContent=text;b.hidden=false;}
  function when(ms){
    try{return new Date(ms).toLocaleString('{{LOCALE}}',{timeZone:'{{TIMEZONE}}',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' {{TZ_LABEL}}';}catch(e){return '';}
  }

  function onPick(pid,val){
    msg(pid,'');
    if(state(pid)==='open'&&val!=='other'){commit(pid,'answer');return;}
    if(val==='other')$(pid+'-othertext').focus();
    paint();
  }
  function startChange(pid){
    if(state(pid)!=='locked')return;
    editing[pid]={rev:(answers[pid]&&answers[pid].rev)||''};
    fill(pid,answers[pid]);msg(pid,'');paint();
  }
  function cancelChange(pid){delete editing[pid];fill(pid,answers[pid]);msg(pid,'');paint();}

  async function commit(pid,action,given){
    if(busy[pid]||!db||readOnly)return;
    var P=parts[pid],d=given||collect(pid);
    if(!d.choice)return;
    if(d.choice==='other'&&!d.other){msg(pid,'Type your answer, then press '+(action==='change'?'Save change':'Save')+'.');$(pid+'-othertext').focus();return;}
    busy[pid]=true;
    try{
      var prev=null;
      if(action==='change'){
        var cur=null;
        try{var s=await db.doc('answers/'+pid).get();cur=s.exists?s.data():null;}
        catch(e){msg(pid,'Could not check the saved answer ('+errCode(e)+'). Try again.');return;}
        var curRev=(cur&&cur.rev)||'';
        if(curRev!==editing[pid].rev){
          if(cur)answers[pid]=cur;
          editing[pid].rev=curRev;
          msg(pid,nameOf(cur&&cur.by)+' changed this answer while you were editing. Check it, then save again.');
          paint();return;
        }
        prev=snap(cur||answers[pid]);
        if(same(prev,d)){cancelChange(pid);return;}
      }
      var ev={id:newId(),part:pid,n:P.q.n,action:action,from:prev,to:d,at:Date.now()};
      var body={n:P.q.n,part:pid,choice:d.choice,label:d.label,other:d.other,note:d.note,by:uid||'',at:ev.at,viaDefault:action==='default',rev:ev.id};
      try{await db.doc('answers/'+pid).set(body);}
      catch(e){msg(pid,'Could not save ('+errCode(e)+'). Check your access and try again.');return;}
      answers[pid]=body;delete editing[pid];msg(pid,'');paint();
      log(ev);
    }finally{busy[pid]=false;}
  }

  function appendEvents(evs){
    if(!uid)return Promise.reject({code:'no_user'});
    var mine=(audits[uid]&&audits[uid].events)||[];
    var next=mine.concat(evs);
    return db.doc('audit/'+uid).set({events:next}).then(function(){audits[uid]={events:next};paint();});
  }
  function log(ev){
    logQueue=logQueue.then(function(){
      return appendEvents([ev])
        .catch(function(){return appendEvents([ev]);})
        .catch(function(){unlogged.push(ev);$('logwarn').hidden=false;});
    });
    return logQueue;
  }
  $('retrylog').addEventListener('click',function(){
    var evs=unlogged;unlogged=[];$('logwarn').hidden=true;
    logQueue=logQueue.then(function(){
      return appendEvents(evs).catch(function(){unlogged=evs.concat(unlogged);$('logwarn').hidden=false;});
    });
  });

  function eventsFor(pid){
    var out=[];
    Object.keys(audits).forEach(function(by){
      var evs=(audits[by]&&audits[by].events)||[];
      evs.forEach(function(e){if(e&&e.part===pid)out.push({by:by,e:e});});
    });
    out.sort(function(a,b){return (a.e.at||0)-(b.e.at||0);});
    return out;
  }
  function shown(s){s=s||{};return s.choice==='other'?'Other: '+(s.other||''):(s.label||'');}
  function line(x){
    var e=x.e,nm=nameOf(x.by),t=e.at?' · '+when(e.at):'';
    if(e.action==='change'&&e.from&&e.to&&e.from.choice===e.to.choice&&e.from.other===e.to.other)return nm+' edited the note'+t;
    if(e.action==='change')return nm+' changed “'+shown(e.from)+'” → “'+shown(e.to)+'”'+t;
    return nm+' chose “'+shown(e.to)+'”'+(e.action==='default'?' (default)':'')+t;
  }

  function paint(){
    var total=0,done=0;
    Object.keys(parts).forEach(function(pid){
      var P=parts[pid],a=answers[pid],st=state(pid);total++;
      var ot=$(pid+'-othertext'),nt=$(pid+'-note'),frozen=(st==='locked'||st==='ro');
      if(frozen&&a&&a.choice)fill(pid,a);
      P.el.querySelectorAll('input[type=radio]').forEach(function(r){r.disabled=frozen;r.parentNode.classList.toggle('sel',r.checked);});
      ot.disabled=frozen;nt.disabled=frozen;
      var cur=collect(pid),sv=$(pid+'-save');
      sv.hidden=!(st==='changing'||(st==='open'&&cur.choice==='other'));
      sv.textContent=st==='changing'?'Save change':'Save';
      sv.disabled=st==='changing'?same(snap(a),cur):!cur.other;
      $(pid+'-change').hidden=st!=='locked';
      $(pid+'-cancel').hidden=st!=='changing';
      var evs=eventsFor(pid),changes=evs.filter(function(x){return x.e.action==='change';}).length;
      var who=P.el.querySelector('.who');
      if(a&&a.choice){
        done++;
        var nm=names[a.by]||'';
        who.textContent='Saved'+(a.viaDefault?' (default accepted)':'')+(nm?' by '+nm:'')+(a.at?' · '+when(a.at):'')+(changes?' · changed '+changes+'×':'');
      }else{who.textContent='';}
      var h=$(pid+'-hist');h.hidden=!evs.length;
      h.querySelector('summary').textContent='History ('+evs.length+')';
      var ol=h.querySelector('ol');ol.textContent='';
      evs.forEach(function(x){ol.appendChild(el('li',null,line(x)));});
    });
    Q.forEach(function(q){
      var all=q.parts.every(function(p){var a=answers[p.id];return a&&a.choice;});
      $('card'+q.n).classList.toggle('answered',all);
    });
    $('count').textContent=done+' of '+total+' answered';
    $('meter').style.width=(total?Math.round(done*100/total):0)+'%';
  }
  function resolveNames(){
    if(!user||!user.profiles)return;
    var ids=[];
    function add(b){if(b&&ids.indexOf(b)<0&&!(b in names))ids.push(b);}
    Object.keys(answers).forEach(function(k){add(answers[k].by);});
    Object.keys(audits).forEach(add);
    if(!ids.length)return;
    user.profiles(ids).then(function(ps){ids.forEach(function(i){names[i]=(ps&&ps[i]&&ps[i].name)||'';});paint();}).catch(function(){});
  }
  function linkIssues(){
    document.querySelectorAll('.iss').forEach(function(s){
      var txt=s.textContent;
      if(!/#\d+/.test(txt)||s.querySelector('a'))return;
      s.textContent='';
      txt.split(/(#\d+)/).forEach(function(part){
        var m=/^#(\d+)$/.exec(part);
        if(m&&ISSUE_BASE){var a=document.createElement('a');a.href=ISSUE_BASE+m[1];a.target='_blank';a.rel='noopener noreferrer';a.textContent=part;a.setAttribute('aria-label','Open issue '+part);s.appendChild(a);}
        else if(part){s.appendChild(document.createTextNode(part));}
      });
    });
  }
  $('accdef').addEventListener('click',function(){
    if(!db||readOnly)return;
    var pids=Object.keys(parts).filter(function(pid){var P=parts[pid];return groupOf[P.q.g].acceptDefaults&&P.defId&&state(pid)==='open';});
    var chain=Promise.resolve();
    pids.forEach(function(pid){
      var P=parts[pid],lb=$(pid+'-'+P.defId).parentNode.querySelector('.lbl span').textContent;
      chain=chain.then(function(){return commit(pid,'default',{choice:P.defId,label:lb,other:'',note:$(pid+'-note').value.trim()});});
    });
  });

  build();linkIssues();paint();

  (async function init(){
    var offline='Saving is not available in this view. Open the page in claude.ai while signed in.';
    if(!window.claude||!claude.use){banner('info',offline);$('accdef').disabled=true;return;}
    try{user=await claude.use('user');}catch(e){user=null;}
    try{db=await claude.use('db');}catch(e){db=null;}
    if(!db){banner('info',offline);$('accdef').disabled=true;return;}
    try{if(user&&user.id)uid=await user.id();}catch(e){}
    try{if(user&&user.can){var cw=await user.can('data.write');if(cw===false){readOnly=true;banner('warn','You can read this page but not save answers. Ask the owner to share it with you as a Contributor or Editor.');$('accdef').disabled=true;}}}catch(e){}
    paint();
    db.collection('answers').onSnapshot(function(snap){
      answers={};snap.docs.forEach(function(d){answers[d.id]=d.data()||{};});
      paint();resolveNames();
    },function(e){banner('warn','Saved answers could not load ('+errCode(e)+').');});
    db.collection('audit').onSnapshot(function(snap){
      audits={};snap.docs.forEach(function(d){audits[d.id]=d.data()||{};});
      paint();resolveNames();
    },function(e){banner('warn','The change history could not load ('+errCode(e)+').');});
  })();
```

- [x] **Step 4: Run all tests (green)**

Run: `npm test`
Expected: `template.test.mjs` 7 pass; `lock.test.mjs` 14 pass; `fail 0`.

- [x] **Step 5: Run the old-template red check**

Run: `TEMPLATE=<scratchpad>/template-0.2.0-broken.html npm test`
Expected: failures, including `page script threw`.

- [x] **Step 6: Run `check.mjs` on a filled sample**

Fill the template with `examples/sample-questions.md` (same values as `tests/fill.mjs`) into `<scratchpad>/sample-0.3.0.html`, then run `node plugins/lazytools/skills/help-me-decide/check.mjs <scratchpad>/sample-0.3.0.html`.
Expected: `OK`.

- [x] **Step 7: Commit (controller)**

```bash
git add plugins/lazytools/skills/help-me-decide/template.html
git commit -m "feat(help-me-decide): lock saved answers and log changes per person"
```

---

### Task 4: Skill instructions, ADR template, version

**Files:**
- Modify: `plugins/lazytools/skills/help-me-decide/SKILL.md` (Phase 1 step 4; Phase 2 steps 1, 2, 4, 7)
- Modify: `plugins/lazytools/skills/help-me-decide/adr-template.md` (Decision table note; new Changes section; Record)
- Modify: `plugins/lazytools/.claude-plugin/plugin.json` (`0.2.2` → `0.3.0`)
- Modify: `plugins/lazytools/README.md` only if it describes how answers save (read it first; add one line: "Saved answers lock. A change needs Change answer, and every change is logged.")

**Interfaces:**
- Consumes: the data shapes from Task 3.

- [x] **Step 1: Phase 1 step 4 in `SKILL.md`**

Replace ``Publish with the Artifact tool and `capabilities: {"db": {}, "user": {"scopes": ["profile"]}}`.`` with:

```
Publish with the Artifact tool and `capabilities: {"db": {"rules": [{"path": "audit", "read": "view", "write": "owner"}, {"path": "audit/{self}", "write": "interact"}]}, "user": {"scopes": ["profile"]}}`. The rules let everyone who can open the page read the change log, and let each person write only their own log.
```

and replace `Answers save to the `answers` collection, one document per part id.` with:

```
Answers save to the `answers` collection, one document per part id. Each save also adds one event to `audit/<person id>`.
```

- [x] **Step 2: Phase 2 step 1 in `SKILL.md`**

Replace the whole step 1 with:

```
1. **Read the answers and the change log.** Use `ArtifactData` with `action: list` on `answers`, then on `audit`. Each `answers` document has: `n`, `part`, `choice`, `label`, `other`, `note`, `by`, `at`, `viaDefault`, `rev`. Each `audit` document id is a person id; its `events` list holds `{id, part, n, action, from, to, at}`, where `action` is `answer`, `change` or `default`. Use `action: profiles` on the `audit` ids and the `by` ids to get names. The author of an event is the `audit` document id, which the server checks. If `answers.by` differs from the author of the event whose `id` equals `answers.rev`, say so in the Record section. If there is no `audit` collection, the page is older than 0.3.0: write "No change history recorded (page older than 0.3.0)."
```

- [x] **Step 3: Phase 2 step 2 in `SKILL.md`**

Replace the first sentence of step 2 with:

```
2. **Compare with the page.** Every part is one of: **Answered**, **Changed (N×)** (N = its `change` events), **Default applied by the owner** (`viaDefault: true`), or **Unanswered**. An answer with no matching event is marked "not in the log".
```

Keep the rest of step 2 unchanged.

- [x] **Step 4: Phase 2 step 4 in `SKILL.md`**

Add this bullet after the bullet that starts "Fill Context from the issues":

```
   - Fill the Changes section from the `change` events, one line each, in time order: "Q1b: 'Retry only once.' → 'Retry up to 3 times.', by <name>, 30 Sep 2026 10:15 IST." For a note-only change write "Q1b: note edited by <name>, <date>", then quote the new note. Name only, never email. If two people share a name, add the first 6 characters of their id.
```

- [x] **Step 5: Phase 2 step 7 in `SKILL.md`**

Replace `question | answer | source (answered, default) | ADR | issue comment posted` with `question | answer | source (answered, changed N×, default) | ADR | issue comment posted`.

- [x] **Step 6: `adr-template.md`**

Replace the line `Mark every row **Answered** or **Default applied**. Never present a default as a decision someone made.` with:

```
Mark every row **Answered**, **Changed (N×)**, **Default applied** or **Unanswered**. Never present a default as a decision someone made.

## Changes

{{One line per change, in time order, from the page's change log. Name only, never email.}}

- Q1 (#123): '{{from}}' → '{{to}}', by {{name}}, {{date and time with timezone}}.
- {{or "No answer was changed." or "No change history recorded (page older than 0.3.0)."}}
```

In the Record section, add after the "Raw answers" line:

```
- Change log: read from the artifact `audit` collection on {{date}}. {{Any answer marked "not in the log", or any `by` that differs from the log author, or "All answers match the log."}}
```

- [x] **Step 7: Version**

In `plugins/lazytools/.claude-plugin/plugin.json` change `"version": "0.2.2"` to `"version": "0.3.0"`.

- [x] **Step 8: Check**

Run: `grep -n "audit" plugins/lazytools/skills/help-me-decide/SKILL.md plugins/lazytools/skills/help-me-decide/adr-template.md` and `node -e "JSON.parse(require('fs').readFileSync('plugins/lazytools/.claude-plugin/plugin.json','utf8'))"` and `npm test`.
Expected: the new lines appear; JSON parses; all tests pass.

- [x] **Step 9: Commit (controller)**

```bash
git add plugins/lazytools/skills/help-me-decide/SKILL.md plugins/lazytools/skills/help-me-decide/adr-template.md plugins/lazytools/.claude-plugin/plugin.json plugins/lazytools/README.md
git commit -m "docs(help-me-decide): publish rules, change log in Phase 2 and ADR; bump to 0.3.0"
```

---

### Task 5: Live check on claude.ai (controller and user)

**Files:**
- Create (scratchpad only): `<scratchpad>/sample-0.3.0.html` (from Task 3 Step 6)

**Interfaces:**
- Consumes: everything above.

- [x] **Step 1: Publish the filled sample** with the Global Constraints capabilities, `icon` `checklist`, title `Answer Lock Test`.
- [x] **Step 2: Ask the user** to tap one answer, press Change answer, pick another option, press Save change, then press Change answer and Cancel on another part.
- [x] **Step 3: Read back** `answers` and `audit` with ArtifactData. Expected: `audit/<user id>` holds `answer` and `change` events whose `id` matches `answers.rev`; the user's id in the path equals `answers.by`.
- [x] **Step 4: Push the branch and open a PR** (push in its own command, then `gh pr create` without `--base`). The PR body lists what was tested, including the live check, and what was not.

## Self-review notes

- Spec coverage: success criteria 1–3 (Task 3, tests 1–3, 5); 4 (Task 1 rules; tests 1, "no user id"); 5 (test "teammate saved"); 6 (test "history"); 7–8 (Task 4); save sequence and retry (Task 3, Review Focus 3); read-only (test 7); default button (test 8).
- Names consistent across tasks: `state`, `commit`, `appendEvents`, `log`, `eventsFor`, ids `-save`, `-change`, `-cancel`, `-msg`, `-hist`, `logwarn`, `retrylog`.
