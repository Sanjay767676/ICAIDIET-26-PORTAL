#!/usr/bin/env node
// Generates the two placeholder template PDFs for the Phase 2 R2 bucket
// (bucket "Phase2", object keys templates/camera-ready-template.pdf and
// templates/copyright-form-template.pdf).
//
// These are PLACEHOLDERS so the download buttons work end-to-end before the
// real conference documents exist. To ship the real templates later, drop the
// real PDFs into backend/assets/phase2-templates/ under the same names and run
// (from backend/; R2 bucket names must be lowercase, hence "phase2"):
//   npx wrangler r2 bucket create phase2
//   npx wrangler r2 object put phase2/templates/camera-ready-template.pdf --file assets/phase2-templates/camera-ready-template.pdf
//   npx wrangler r2 object put phase2/templates/copyright-form-template.pdf --file assets/phase2-templates/copyright-form-template.pdf

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Minimal one-page PDF with correct xref offsets (all-ASCII content, so
// string length == byte length under latin1).
function buildPdf(lines) {
  const esc = (s) => String(s).replace(/([\\()])/g, '\\$1');
  let ops = 'BT\n';
  let first = true;
  for (const line of lines) {
    ops += first ? '60 760 Td\n' : '0 -28 Td\n';
    ops += `/F1 ${line.size} Tf\n(${esc(line.text)}) Tj\n`;
    first = false;
  }
  ops += 'ET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'phase2-templates');
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, 'camera-ready-template.pdf'), buildPdf([
  { text: "ICAIDIET'26 - Camera-Ready Template", size: 22 },
  { text: 'PLACEHOLDER template document.', size: 12 },
  { text: 'Replace this file with the real camera-ready template PDF at', size: 12 },
  { text: 'backend/assets/phase2-templates/camera-ready-template.pdf,', size: 12 },
  { text: 'then re-upload it to the phase2 R2 bucket (see script header).', size: 12 },
]));

writeFileSync(join(outDir, 'copyright-form-template.pdf'), buildPdf([
  { text: "ICAIDIET'26 - Copyright Form", size: 22 },
  { text: 'PLACEHOLDER copyright form document.', size: 12 },
  { text: 'Replace this file with the real copyright form template PDF at', size: 12 },
  { text: 'backend/assets/phase2-templates/copyright-form-template.pdf,', size: 12 },
  { text: 'then re-upload it to the phase2 R2 bucket (see script header).', size: 12 },
]));

console.log('Wrote placeholder PDFs to', outDir);
