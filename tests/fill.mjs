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
