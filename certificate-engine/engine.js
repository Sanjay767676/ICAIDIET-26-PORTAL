// ICAIDIET'26 e-certificate engine
// Draws participant name + college onto the PNG/JPG template and outputs a PDF.
// Pure JS (pdf-lib) — no Chromium. Runs on Render, a laptop, or a Worker.

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(DIR, 'fonts');

// ---- Template geometry --------------------------------------------------
// Page = A4 landscape. Underline positions were measured on the 5000x3535
// template (v2, no Mr/Mrs printed): name line x 1443-4465 @ y 2061, college line x 530-3881 @ y 2199.
const PAGE_W = 841.89, PAGE_H = 595.28;
const SRC_W = 5000, SRC_H = 3535;
const px = (x) => (x / SRC_W) * PAGE_W;
const py = (y) => PAGE_H - (y / SRC_H) * PAGE_H; // top-origin px -> pdf pt

export const SLOTS = {
  name:    { x1: px(1443), x2: px(4465), lineY: py(2061) },
  college: { x1: px(530),  x2: px(3881), lineY: py(2199) },
  certId:  { x: px(150),   y: py(3470) },
};

const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

// Colours sampled from the template
export const COLORS = {
  brown: '#9F5D16', // "CERTIFICATE"
  navy:  '#101F3B', // "YORKVILLE UNIVERSITY, CANADA"
  blue:  '#0F3B7B', // "SNS COLLEGE OF TECHNOLOGY-AI CAMPUS" in body
  black: '#000000', // body text
};

// ---- Style presets (pick one after reviewing samples) -------------------
// size = preferred pt, min = smallest allowed before flagging for review,
// lift = baseline distance above the printed underline (pt)
export const STYLES = {
  A_classic: {
    label: 'A · Classic — Noto Serif (matches body text)',
    name:    { font: 'NotoSerif-Bold.ttf',            size: 16.5, min: 12, color: COLORS.black,  lift: 3.5 },
    college: { font: 'NotoSerif-SemiBoldItalic.ttf',  size: 16, min: 12, color: COLORS.black,  lift: 3.5 },
  },
  B_elegant: {
    label: 'B · Elegant — Playfair Display + EB Garamond',
    name:    { font: 'PlayfairDisplay-BoldItalic.ttf', size: 18.5, min: 13, color: COLORS.black, lift: 3.5 },
    college: { font: 'EBGaramond-SemiBold.ttf',        size: 18, min: 13, color: COLORS.black,  lift: 3.5 },
  },
  C_script: {
    label: 'C · Script — Alex Brush + Cormorant Garamond',
    name:    { font: 'AlexBrush-Regular.ttf',       size: 24, min: 17, color: COLORS.black, lift: 4.5 },
    college: { font: 'CormorantGaramond-Bold.ttf',  size: 18.5, min: 13, color: COLORS.black,  lift: 3.5 },
  },
  D_formal: {
    label: 'D · Formal caps — Cinzel',
    name:    { font: 'Cinzel-Bold.ttf',     size: 16.5, min: 11, color: COLORS.black, lift: 3.5, upper: true },
    college: { font: 'Cinzel-SemiBold.ttf', size: 14.5, min: 10,  color: COLORS.black, lift: 3.5 },
  },
};
// ---- Printed text -------------------------------------------------------
// Production: the Worker sends `name` and `college` already composed from the
// author record (title + first name + last name, college as entered). They are
// printed exactly as received — no re-casing, no shortening — so the certificate,
// the database and the verifier always say the same thing.
//
// composeName() is only the fallback for local samples (sample.js) and mirrors
// certificateName() in backend/src/certificates.ts.
const TITLES = { mr: 'Mr.', mrs: 'Mrs.', ms: 'Ms.', miss: 'Ms.', dr: 'Dr.', prof: 'Prof.' };
const HONORIFIC_AT_START = /^(dr|mrs|mr|ms|miss|prof)\b\s*\.?\s*/i;
const squash = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function composeName(title, first, last) {
  let typedTitle = '';
  const strip = (v) => {
    let part = squash(v);
    const m = part.match(HONORIFIC_AT_START);
    if (m) { typedTitle ||= TITLES[m[1].toLowerCase()] || ''; part = part.slice(m[0].length).trim(); }
    return part;
  };
  const full = squash(`${strip(first)} ${strip(last)}`);
  const chosen = TITLES[squash(title).replace(/\.$/, '').toLowerCase()] || '';
  const t = chosen || typedTitle;
  return t ? `${t} ${full}` : full;
}

// ---- Rendering ----------------------------------------------------------
const fontCache = new Map();
const readFont = (f) => {
  if (!fontCache.has(f)) fontCache.set(f, fs.readFileSync(path.join(FONT_DIR, f)));
  return fontCache.get(f);
};
let templateBytes = null;

const widthAt = (font, text, size) => font.widthOfTextAtSize(text, size);

// Largest size between `max` and `min` (0.25 pt steps) at which every line fits.
function fitLines(font, lines, maxW, max, min) {
  for (let s = max; s >= min; s -= 0.25) {
    if (lines.every((l) => widthAt(font, l, s) <= maxW)) return s;
  }
  return null;
}

// Split a long college into two balanced lines, preferring a comma, else a space.
function splitTwo(text) {
  const mid = text.length / 2;
  let best = -1, bestScore = Infinity;
  for (let i = 1; i < text.length - 1; i++) {
    const ch = text[i];
    if (ch !== ' ' && ch !== ',') continue;
    const score = Math.abs(i - mid) - (ch === ',' || text[i - 1] === ',' ? 6 : 0);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  if (best < 0) return [text];
  const cut = text[best] === ',' ? best + 1 : best;
  return [text.slice(0, cut).trim(), text.slice(cut).trim()];
}

const NAME_MIN = 11;          // pt, below this the name is still shrunk to fit but flagged
const COLLEGE_ONE_LINE_MIN = 10;
const COLLEGE_TWO_LINE_MAX = 8.5; // two lines must fit between the name line and the college line
const COLLEGE_TWO_LINE_MIN = 7;

/**
 * @param {{name?:string, college?:string, title?:string, first_name?:string, last_name?:string, certId?:string}} p
 * @returns {{pdf: Uint8Array, name: string, college: string, warnings: string[]}}
 */
export async function generateCertificate(p, styleKey = 'A_classic', opts = {}) {
  const style = STYLES[styleKey];
  if (!style) throw new Error(`Unknown style ${styleKey}`);
  templateBytes ??= fs.readFileSync(opts.template ?? path.join(DIR, 'assets', 'template.jpg'));

  const name = p.name !== undefined ? String(p.name) : composeName(p.title, p.first_name, p.last_name);
  const college = p.college !== undefined ? String(p.college).replace(/\s+/g, ' ').trim() : '';
  const warnings = [];
  if (!name.trim()) warnings.push('empty_name');
  if (!college) warnings.push('empty_college');

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("ICAIDIET'26 Certificate");
  pdf.setAuthor('SNS College of Technology');
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const bg = await pdf.embedJpg(templateBytes);
  page.drawImage(bg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const PAD = 6; // keep clear of "of" / "has successfully"
  const draw = (text, slot, st, font, size, y) => {
    const w = widthAt(font, text, size);
    page.drawText(text, { x: slot.x1 + (slot.x2 - slot.x1 - w) / 2, y, size, font, color: hex(st.color) });
  };

  // Name: one line, shrink to fit.
  {
    const st = style.name, slot = SLOTS.name;
    const font = await pdf.embedFont(readFont(st.font), { subset: false });
    const text = st.upper ? name.toUpperCase() : name;
    const maxW = slot.x2 - slot.x1 - PAD * 2;
    let size = fitLines(font, [text], maxW, st.size, NAME_MIN);
    if (size === null) { size = (maxW / widthAt(font, text, NAME_MIN)) * NAME_MIN; warnings.push('name_small_font'); }
    draw(text, slot, st, font, size, slot.lineY + st.lift);
  }

  // College: one line (shrink down to 10 pt); if longer, two lines (10 -> 7 pt);
  // if even that is not enough, one line at whatever size fits. Never cut.
  {
    const st = style.college, slot = SLOTS.college;
    const font = await pdf.embedFont(readFont(st.font), { subset: false });
    const maxW = slot.x2 - slot.x1 - PAD * 2;
    const base = slot.lineY + st.lift;
    let size = fitLines(font, [college], maxW, st.size, COLLEGE_ONE_LINE_MIN);
    if (size !== null) {
      draw(college, slot, st, font, size, base);
    } else {
      const lines = splitTwo(college);
      const s2 = lines.length === 2 ? fitLines(font, lines, maxW, COLLEGE_TWO_LINE_MAX, COLLEGE_TWO_LINE_MIN) : null;
      if (s2 !== null) {
        draw(lines[1], slot, st, font, s2, base);
        draw(lines[0], slot, st, font, s2, base + s2 * 1.08);
        warnings.push('college_two_lines');
      } else {
        size = (maxW / widthAt(font, college, COLLEGE_ONE_LINE_MIN)) * COLLEGE_ONE_LINE_MIN;
        draw(college, slot, st, font, size, base);
        warnings.push('college_small_font');
      }
    }
  }

  if (p.certId) {
    const f = await pdf.embedFont(readFont('NotoSerif-SemiBold.ttf'), { subset: false });
    page.drawText(`Certificate ID: ${p.certId}`, { x: SLOTS.certId.x, y: SLOTS.certId.y, size: 7.5, font: f, color: hex('#6B6B6B') });
  }

  return { pdf: await pdf.save(), name, college, warnings };
}
