import fs from 'fs';

const file = process.argv[2];
if (!file) { console.log('Usage: node check.mjs <filled-page.html>'); process.exit(1); }

const html = fs.readFileSync(file, 'utf8');
const errors = [];

// 1. Check for placeholders
const lines = html.split('\n');
lines.forEach((line, lineNum) => {
  let match;
  const placeholderRegex = /\{\{[A-Z_]+\}\}/g;
  while ((match = placeholderRegex.exec(line)) !== null) {
    errors.push(`Placeholder ${match[0]} found at line ${lineNum + 1}`);
  }
});

// 2. Extract GROUPS and Q arrays
const extractArray = (name) => {
  const regex = new RegExp(`var ${name}=\\[(.*?)\\];`, 's');
  const match = html.match(regex);
  if (!match) return null;
  try {
    return new Function('return [' + match[1] + ']')();
  } catch (e) {
    errors.push(`Failed to parse ${name}: ${e.message}`);
    return null;
  }
};

const GROUPS = extractArray('GROUPS');
const Q = extractArray('Q');

if (!GROUPS || !Q) {
  if (errors.length === 0) errors.push('Could not find or parse GROUPS or Q');
  errors.forEach(e => console.log(e));
  process.exit(1);
}

// 3. Build lookups
const groupIds = new Set(GROUPS.map(g => g.id));
const allPartIds = new Set();
const questionNums = new Set();

// 4. Validate questions
Q.forEach((q, i) => {
  // Question number unique
  if (questionNums.has(q.n)) errors.push(`Q: duplicate question number ${q.n}`);
  questionNums.add(q.n);

  // Group exists
  if (!groupIds.has(q.g)) errors.push(`Q${q.n}: group "${q.g}" does not exist`);

  // Validate parts
  q.parts.forEach((p, pi) => {
    // Part id unique
    if (allPartIds.has(p.id)) errors.push(`Q${q.n}: duplicate part id "${p.id}"`);
    allPartIds.add(p.id);

    // Part id matches pattern
    if (!/^[A-Za-z0-9]+$/.test(p.id)) errors.push(`Q${q.n}: part id "${p.id}" invalid`);

    // Part has 2-4 options (not counting "Other" which is added by page)
    if (p.opts.length < 2 || p.opts.length > 4) {
      errors.push(`Q${q.n} part ${p.id}: ${p.opts.length} options (need 2-4)`);
    }

    // Option ids unique within part
    const optIds = new Set();
    p.opts.forEach(o => {
      if (optIds.has(o.id)) errors.push(`Q${q.n} part ${p.id}: duplicate opt id "${o.id}"`);
      optIds.add(o.id);
    });

    // Exactly one default or nodef
    const withD = p.opts.filter(o => o.d === 1).length;
    const withNodef = p.nodef ? 1 : 0;
    if (withD + withNodef !== 1) {
      errors.push(`Q${q.n} part ${p.id}: need exactly one d:1 or nodef:1`);
    }
  });
});

errors.forEach(e => console.log(e));
if (errors.length === 0) console.log('OK');
process.exit(errors.length ? 1 : 0);
