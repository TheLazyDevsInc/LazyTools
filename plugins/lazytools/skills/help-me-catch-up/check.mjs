import fs from 'fs';

const file = process.argv[2];
if (!file) { console.log('Usage: node check.mjs <filled-page.html>'); process.exit(1); }

const html = fs.readFileSync(file, 'utf8');
const errors = [];

// 1. Placeholders and leftover examples
html.split('\n').forEach((line, i) => {
  for (const m of line.matchAll(/\{\{[A-Z_]+\}\}/g)) errors.push(`Placeholder ${m[0]} found at line ${i + 1}`);
  if (/['"]EXAMPLE:/.test(line)) errors.push(`Example entry left at line ${i + 1}`);
});

// 2. Data arrays
const extractArray = (name) => {
  const match = html.match(new RegExp(`var ${name}=\\[([\\s\\S]*?)\\n\\s*\\];`));
  if (!match) { errors.push(`Could not find var ${name}=[...];`); return null; }
  try { return new Function('return [' + match[1] + ']')(); }
  catch (e) { errors.push(`Failed to parse ${name}: ${e.message}`); return null; }
};
const NOW = extractArray('NOW');
const STORY = extractArray('STORY');
const STATE = extractArray('STATE');
const OPTIONS = extractArray('OPTIONS');
const CAVEATS = extractArray('CAVEATS');

if (NOW && (NOW.length < 1 || NOW.length > 3)) errors.push('NOW: needs 1 to 3 paragraphs');
if (NOW) NOW.forEach((s, i) => { if (typeof s !== 'string' || !s.trim()) errors.push(`NOW[${i}]: no text`); });

if (STORY) {
  if (STORY.length < 2 || STORY.length > 10) errors.push('STORY: needs 2 to 10 entries');
  STORY.forEach((s, i) => { if (!s.t) errors.push(`STORY[${i}]: no text`); });
}

if (STATE) {
  const kinds = new Set();
  STATE.forEach((g, i) => {
    if (!['done', 'doing', 'open', 'blocked'].includes(g.kind)) errors.push(`STATE[${i}]: kind "${g.kind}" must be done, doing, open or blocked`);
    if (kinds.has(g.kind)) errors.push(`STATE: duplicate kind "${g.kind}"`);
    kinds.add(g.kind);
    if (!Array.isArray(g.items) || !g.items.length) errors.push(`STATE[${i}] (${g.kind}): no items, leave the kind out instead`);
    else g.items.forEach((t, j) => { if (typeof t !== 'string' || !t.trim()) errors.push(`STATE[${i}].items[${j}]: no text`); });
  });
  if (!STATE.length) errors.push('STATE: needs at least one list');
}

if (OPTIONS) {
  if (OPTIONS.length < 2 || OPTIONS.length > 3) errors.push(`OPTIONS: needs 2 or 3 options, found ${OPTIONS.length}`);
  const ids = new Set();
  OPTIONS.forEach((o, i) => {
    const at = `OPTIONS[${i}]`;
    if (!/^[a-c]$/.test(o.id || '')) errors.push(`${at}: id "${o.id}" must be a, b or c`);
    if (ids.has(o.id)) errors.push(`${at}: duplicate id "${o.id}"`);
    ids.add(o.id);
    for (const f of ['title', 'why', 'first', 'prompt']) if (!o[f] || !String(o[f]).trim()) errors.push(`${at}: no ${f}`);
  });
  if (OPTIONS.filter((o) => o.rec).length !== 1) errors.push('OPTIONS: mark exactly one option with rec:1');
}

if (CAVEATS) CAVEATS.forEach((s, i) => { if (typeof s !== 'string' || !s.trim()) errors.push(`CAVEATS[${i}]: no text`); });

errors.forEach((e) => console.log(e));
if (errors.length === 0) console.log('OK');
process.exit(errors.length ? 1 : 0);
