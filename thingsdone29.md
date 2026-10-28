# Camera-ready guidelines vs template comparison

## Files found (as requested)
- User portal guidelines: `user-portal/src/components/portal/Phase2GuidelinesPage.tsx` (Phase 2 Guidelines / Camera-Ready Paper Guidelines)
- Templates referenced/served:
  - Backend serves via `GET /api/phase2/templates/:kind` from `PHASE2_BUCKET` (`phase2` bucket). Mappings in `backend/src/index.ts:2775-2788`:
    - `camera-ready` → key `templates/camera-ready-template.docx`, filename `Camera_Ready_Template.docx` (Word doc)
    - `copyright` → key `templates/copyright-form-template.docx`, filename `Copyright_Form_Template.docx` (Word doc)
  - Backend placeholders/scripts: `backend/scripts/generate-phase2-placeholders.mjs` (mentions PDF placeholders); R2 placeholders stored under `.wrangler/state/.../phase2/blobs/...` as PDFs (from grep).
  - Local template files in repo: `backend/assets/phase2-templates/camera_ready_template.docx`, `backend/assets/phase2-templates/Copyright form.docx` (names differ from keys/filenames served).
  - User portal downloads templates via `/api/phase2/templates/:kind` and shows "Camera Ready Template" / "Copyright Form" buttons (Phase2Page.tsx:349-384). Also links sample copyright form `sample_copyright.docx` from `user-portal/public/sample_copyright.docx`.

## Guidelines from Phase2GuidelinesPage.tsx
1. Title/Text/Keywords: Paper title bold 14pt centered; author details 9pt regular; body text 10pt justified; keywords 10pt regular. (lines ~64-77)
2. Page Setup: Custom margins 5.7 cm top, 5.7 cm bottom, 4.5 cm left, 4.5 cm right; gutter 0 cm (Left). Portrait. Apply to whole document; section start on new page; vertical alignment Top. Different First Page and Different Odd & Even Pages both enabled. Header 4.7 cm from edge; footer 0 cm from edge. (lines ~99-150)
3. Headings: Heading 1 multilevel [Chapter Number].[Section Number] e.g. 1.1 Introduction / 2.1 Introduction. Heading 2 [Chapter].[Section].[Subsection] e.g. 1.1.1 Background. (lines ~173-185)
4. Figures/Tables: Figure captions 9pt centered, "Figure X.Y" label italic, X = chapter number. Table captions 9pt centered, label bold italics, numbered [Chapter].[Table Number]. (lines ~208-219)
5. Citations/References: Numbered in square brackets in order of appearance [1],[2],[3]. Template also mentions author-date (Aggarwal, 2026)/(Sodhi 2026) - says confirm which style with organizers. References 9pt, left-aligned with hanging indent, strictly Harvard style. (lines ~243-254)
6. Compliance warning. (lines ~258-272)

## Template files (what exists)
- `backend/assets/phase2-templates/camera_ready_template.docx` (PK zip; docx)
- `backend/assets/phase2-templates/Copyright form.docx` (PK zip; docx)
- `user-portal/public/sample_copyright.docx` exists (also docx)
- Served filenames/keys differ from local asset names; backend code points to `templates/camera-ready-template.docx` and `templates/copyright-form-template.docx` in PHASE2_BUCKET.

## Mismatches / observations logged
- **Filename/key mismatch**: Guidelines say "using the official conference template" and portal serves `Camera_Ready_Template.docx` (camera-ready kind) / `Copyright_Form_Template.docx`. Local assets are named `camera_ready_template.docx` and `Copyright form.docx` (spaces/underscores). The backend maps to different keys (`templates/camera-ready-template.docx`, `templates/copyright-form-template.docx`) than the local asset filenames; need to confirm actual files uploaded to PHASE2_BUCKET match the served names/structure.
- **Template format vs placeholders**: Placeholders script generates PDFs (`backend/scripts/generate-phase2-placeholders.mjs`) but backend serves as `.docx` with specific content types and filenames; actual templates appear to be .DOCX files. The script says "replace placeholders with real PDFs" but code serves .DOCX - this could be a mismatch in expected format. **Potential mismatch**: Guidelines say "using the official conference template" (general), backend serves Word documents (.DOCX). That’s consistent with "authors fill them in and export a PDF to upload" as noted in CODEBASE_NOTES (line ~428 context) - authors download .DOCX templates, edit and upload PDF. The templates themselves are .DOCX; guidelines describe formatting requirements authors must follow.
- **Citation style ambiguity**: Guidelines explicitly say template mentions both numbered [1] and author-date (Aggarwal 2026) and tell authors to confirm with organizers which style to follow. This is noted as ambiguous in the guidelines text itself (line ~243). Not strictly a "mismatch" between guidelines and template text in repo, but an internal inconsistency/uncertainty documented.
- **Heading numbering example**: Guidelines say Heading 1 as `[Chapter Number].[Section Number]` (e.g. 1.1 Introduction) and Heading 2 as `[Chapter].[Section].[Subsection]` (e.g. 1.1.1). The exact multilevel numbering scheme in the actual .DOCX template (styles/numbering) cannot be fully inspected from grep/read alone without parsing docx XML - this is a potential source of mismatch if template's multilevel list doesn't match exactly.
- **Margins/header/footer specifics**: Guidelines give precise cm values (5.7 top/bottom, 4.5 left/right, header 4.7 cm, footer 0 cm). The actual page setup in the .DOCX templates needs to match these values; cannot confirm from current repo inspection.
- **Local vs served naming**: Backend expects keys `templates/camera-ready-template.docx` and `templates/copyright-form-template.docx` in PHASE2_BUCKET. Local assets use different names (`camera_ready_template.docx`, `Copyright form.docx`). If the bucket doesn't have files under the expected keys, downloads will 404. This is a deployment/config mismatch risk, not necessarily a content mismatch between guidelines and template content.
- **Copyright template**: Guidelines page is "Camera-Ready Paper Guidelines" (Phase 2 Guidelines) - it describes paper formatting/citations/figures etc. The copyright form is a separate document (different purpose); the guidelines focus on the camera-ready paper formatting, not the copyright form content. The comparison requested is between "camera-ready guidelines in user portal and camera-ready template files" - so the main content comparison is paper formatting guidelines vs camera-ready template. Copyright form is mentioned as separate template; no detailed content guidelines for copyright form found in the guidelines page.

No obvious textual contradictions found in the guidelines page itself. The main "mismatches" are operational/deployment (naming/keys/formats) and the inherent ambiguity noted in citations style.
