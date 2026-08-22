import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const target = path.join(ROOT, 'assets', 'pnm-platform-v18.js');
const fragmentFile = path.join(ROOT, 'scripts', 'm1-client-fragment.js');
const START = '/* PNM:M1:ANALYTICS:START */';
const END = '/* PNM:M1:ANALYTICS:END */';
const fragment = fs.readFileSync(fragmentFile, 'utf8').trim();
const block = `${START}\n${fragment}\n${END}`;
const before = fs.readFileSync(target, 'utf8');
const re = new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
const after = re.test(before) ? before.replace(re, block) : `${before.trimEnd()}\n\n${block}\n`;
fs.writeFileSync(target, after);
console.log(JSON.stringify({ target: 'assets/pnm-platform-v18.js', fragment: 'scripts/m1-client-fragment.js', bytesBefore: Buffer.byteLength(before), bytesAfter: Buffer.byteLength(after), bytesAdded: Buffer.byteLength(after) - Buffer.byteLength(before) }, null, 2));
