import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Fills the help-me-test template with examples/sample-tests.md, the way the skill fills it.
export const skillDir = fileURLToPath(new URL('../plugins/lazytools/skills/help-me-test/', import.meta.url));
export const templatePath = skillDir + 'template.html';

const NAMES = ['SETUP', 'CHANGES', 'BEFORE', 'SECTIONS', 'TESTS', 'REPORT'];
const block = (name) => new RegExp(`var ${name}=\\[[\\s\\S]*?\\n\\s*\\];`);
const sample = fs.readFileSync(skillDir + 'examples/sample-tests.md', 'utf8');
const sampleBlocks = Object.fromEntries(NAMES.map((n) => [n, sample.match(block(n))[0]]));
const parse = (n) => new Function(sampleBlocks[n].replace(new RegExp(`^var ${n}=`), 'return ').replace(/;$/, ''))();
export const sampleTests = parse('TESTS');
export const sampleSections = parse('SECTIONS');

const values = {
  TITLE: 'Test title',
  EYEBROW: 'Test eyebrow',
  LEDE: 'Test lede.',
  SOURCE_LINE: 'Test source line.',
  ISSUE_BASE: 'https://github.com/OWNER/REPO/issues/',
  TIMEZONE: 'Asia/Kolkata',
  TZ_LABEL: 'IST',
  LOCALE: 'en-IN',
};

export function filledTestPage() {
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const n of NAMES) {
    if (!block(n).test(html)) throw new Error(`template has no var ${n}=[...]; block to replace`);
    html = html.replace(block(n), () => sampleBlocks[n]);
  }
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (m, name) => (name in values ? values[name] : m));
}
