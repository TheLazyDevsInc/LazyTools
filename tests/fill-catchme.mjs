import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Fills the catch-me-up template with examples/sample-recap.md, the way the skill fills it.
export const skillDir = fileURLToPath(new URL('../plugins/lazytools/skills/catch-me-up/', import.meta.url));
export const templatePath = skillDir + 'template.html';

const NAMES = ['NOW', 'STORY', 'STATE', 'OPTIONS', 'CAVEATS'];
const block = (name) => new RegExp(`var ${name}=\\[[\\s\\S]*?\\n\\s*\\];`);
const sample = fs.readFileSync(skillDir + 'examples/sample-recap.md', 'utf8');
const sampleBlocks = Object.fromEntries(NAMES.map((n) => [n, sample.match(block(n))[0]]));
const parse = (n) => new Function(sampleBlocks[n].replace(new RegExp(`^var ${n}=`), 'return ').replace(/;$/, ''))();
export const sampleStory = parse('STORY');
export const sampleState = parse('STATE');
export const sampleOptions = parse('OPTIONS');
export const sampleCaveats = parse('CAVEATS');

const values = {
  TITLE: 'Recap title',
  EYEBROW: 'Recap eyebrow',
  LEDE: 'Recap lede.',
  SOURCE_LINE: 'Recap source line.',
};

export function filledCatchupPage() {
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const n of NAMES) {
    if (!block(n).test(html)) throw new Error(`template has no var ${n}=[...]; block to replace`);
    html = html.replace(block(n), () => sampleBlocks[n]);
  }
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (m, name) => (name in values ? values[name] : m));
}
