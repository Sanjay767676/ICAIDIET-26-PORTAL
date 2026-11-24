// Generates sample certificates for review (style A_classic; add --all for every style).
// Usage: node sample.js [participants.json] [outDir] [--all]
import fs from 'node:fs';
import path from 'node:path';
import { generateCertificate, STYLES } from './engine.js';

const args = process.argv.slice(2).filter((a) => a !== '--all');
const styles = process.argv.includes('--all') ? Object.keys(STYLES) : ['A_classic'];
const input = args[0] ?? 'sample-participants.json';
const out = args[1] ?? 'samples';
fs.mkdirSync(out, { recursive: true });

const people = JSON.parse(fs.readFileSync(input, 'utf8'));
const report = [];
for (const p of people) {
  const certId = '2026' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  for (const style of styles) {
    const r = await generateCertificate({ ...p, certId }, style);
    const file = path.join(out, `${certId}_${style}.pdf`);
    fs.writeFileSync(file, r.pdf);
    report.push({ certId, style, raw: `${p.first_name} ${p.last_name} | ${p.college}`, printed: `${r.name} | ${r.college}`, warnings: r.warnings.join(',') });
  }
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.table(report.filter((r) => r.style === 'A_classic').map(({ certId, printed, warnings }) => ({ certId, printed, warnings })));
