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
const SETUP = extractArray('SETUP');
const CHANGES = extractArray('CHANGES');
const BEFORE = extractArray('BEFORE');
const SECTIONS = extractArray('SECTIONS');
const TESTS = extractArray('TESTS');
const REPORT = extractArray('REPORT');

const idOk = (id) => typeof id === 'string' && /^[A-Za-z0-9]+$/.test(id);

if (SETUP) SETUP.forEach((s, i) => { if (!s.t) errors.push(`SETUP[${i}]: no text`); });
if (CHANGES) CHANGES.forEach((g, i) => {
  if (!g.title) errors.push(`CHANGES[${i}]: no title`);
  if (!Array.isArray(g.items) || !g.items.length) errors.push(`CHANGES[${i}]: no items`);
  else g.items.forEach((it, j) => { if (!it.t) errors.push(`CHANGES[${i}].items[${j}]: no text`); });
});
if (BEFORE) BEFORE.forEach((b, i) => { if (!b.h || !b.t) errors.push(`BEFORE[${i}]: needs h and t`); });
if (REPORT && !REPORT.length) errors.push('REPORT: say how to report urgent problems');

if (SECTIONS && TESTS) {
  const secIds = new Set();
  SECTIONS.forEach((s, i) => {
    if (!idOk(s.id)) errors.push(`SECTIONS[${i}]: id "${s.id}" invalid (letters and digits only)`);
    if (secIds.has(s.id)) errors.push(`SECTIONS: duplicate id "${s.id}"`);
    secIds.add(s.id);
    if (!s.title) errors.push(`SECTIONS ${s.id}: no title`);
  });
  if (!SECTIONS.some((s) => s.mine)) errors.push('SECTIONS: mark the section everyone does with mine:1');

  const ids = new Set(), nums = new Set(), used = new Set();
  TESTS.forEach((t, i) => {
    const at = `Test ${t.n ?? '#' + i}`;
    if (!idOk(t.id)) errors.push(`${at}: id "${t.id}" invalid (letters and digits only)`);
    if (ids.has(t.id)) errors.push(`${at}: duplicate id "${t.id}"`);
    ids.add(t.id);
    if (!Number.isInteger(t.n)) errors.push(`${at}: n must be a whole number`);
    if (nums.has(t.n)) errors.push(`${at}: duplicate number ${t.n}`);
    nums.add(t.n);
    if (!secIds.has(t.s)) errors.push(`${at}: section "${t.s}" does not exist`);
    used.add(t.s);
    if (!t.title) errors.push(`${at}: no title`);
    if (!Array.isArray(t.steps) || !t.steps.length) errors.push(`${at}: no steps`);
    if (!t.expected) errors.push(`${at}: no expected result`);
    if (!t.tellUs) errors.push(`${at}: no "tell us if"`);
  });
  SECTIONS.forEach((s) => { if (!used.has(s.id)) errors.push(`SECTIONS ${s.id}: has no tests`); });
}

errors.forEach((e) => console.log(e));
if (errors.length === 0) console.log('OK');
process.exit(errors.length ? 1 : 0);
