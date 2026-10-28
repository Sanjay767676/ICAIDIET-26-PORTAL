# Graph Report - conference-portal  (2026-10-28)

## Corpus Check
- 91 files · ~289,412 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 583 nodes · 676 edges · 47 communities (44 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9485d86d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DurableObject
- RpcTarget
- WorkerEntrypoint
- WorkflowEntrypoint
- RegistrationConfigPanel.tsx
- index.ts
- fetch_dump.cjs
- Things Done — Phase 2 (Camera-Ready & Copyright)
- admin-portal/package.json
- paymentOcr.ts
- user-portal/package.json
- reviewer-portal/package.json
- admin-portal/src/App.tsx
- reviewer-portal/src/App.tsx
- ICAIDIET'26 — Codebase Notes
- preparePhase2Submission
- backend/package.json
- MailField.tsx
- build_full_mapping.cjs
- compilerOptions
- compilerOptions
- compilerOptions
- verify-fee-snapshot.cjs
- compilerOptions
- compute_cbe_stats.py
- generate_docx_report.py
- generate-phase2-placeholders.mjs
- storeFinalFile
- cleanDisplayText
- DownloadPanel.tsx
- MySubmissions.tsx
- workspaces
- verifyToken
- userPortalGate
- sendViaResend
- buildZip
- resolveClerkEmail
- Agent instructions — ICAIDIET'26 conference portal

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `compilerOptions` - 15 edges
3. `compilerOptions` - 15 edges
4. `compilerOptions` - 11 edges
5. `MySubmissions()` - 10 edges
6. `ICAIDIET'26 — Codebase Notes` - 10 edges
7. `formatDateTime()` - 7 edges
8. `preparePhase2Submission()` - 7 edges
9. `6. Frontend notes` - 7 edges
10. `Things Done — Phase 2 (Camera-Ready & Copyright)` - 7 edges

## Surprising Connections (you probably didn't know these)
- `MySubmissions()` --references--> `CONFERENCE_TRACKS`  [EXTRACTED]
  user-portal/src/components/portal/MySubmissions.tsx → user-portal/src/data/conferenceTracks.ts
- `Phase2Page()` --references--> `CONFERENCE_TRACKS`  [EXTRACTED]
  user-portal/src/components/portal/Phase2Page.tsx → user-portal/src/data/conferenceTracks.ts

## Import Cycles
- None detected.

## Communities (47 total, 3 thin omitted)

### Community 1 - "RpcTarget"
Cohesion: 0.12
Nodes (15): activeSubs, authors, collegeStats, countryStats, feeBreakdown, fs, paidSubs, path (+7 more)

### Community 2 - "WorkerEntrypoint"
Cohesion: 0.12
Nodes (15): activeSubs, allWithPaymentSubmitted, authors, authorTypeCount, deletedSubs, feeAmountCount, fs, paidSubs (+7 more)

### Community 3 - "WorkflowEntrypoint"
Cohesion: 0.22
Nodes (8): authors, collegeMap, foreignCandidates, fs, path, sortedColleges, subColleges, submissions

### Community 4 - "RegistrationConfigPanel.tsx"
Cohesion: 0.22
Nodes (8): activeSubs, authors, distinctColleges, fs, path, sorted, subAuthorsMap, submissions

### Community 5 - "index.ts"
Cohesion: 0.04
Nodes (36): ACCEPTANCE_TEMPLATE_NAMES, ALLOWED_SUBMISSION_STATUSES, ALLOWED_TYPES, app, AppEnv, BankDetails, Bindings, clerkEmailCache (+28 more)

### Community 6 - "fetch_dump.cjs"
Cohesion: 0.25
Nodes (7): authJson, authRaw, { execSync }, fs, path, subJson, subRaw

### Community 7 - "Things Done — Phase 2 (Camera-Ready & Copyright)"
Cohesion: 0.25
Nodes (7): Current status — everything is done and live, Things Done — Phase 2 (Camera-Ready & Copyright), What an author can now do, What is left for you (small things), What the reviewer will see, What was set up behind the scenes, What you (the admin) will see

### Community 8 - "admin-portal/package.json"
Cohesion: 0.06
Nodes (35): dependencies, apexcharts, lucide-react, react, react-apexcharts, react-dom, @tailwindcss/vite, devDependencies (+27 more)

### Community 9 - "paymentOcr.ts"
Cohesion: 0.29
Nodes (6): authors, fs, path, results, subAuthorsMap, submissions

### Community 10 - "user-portal/package.json"
Cohesion: 0.06
Nodes (31): @clerk/react, dependencies, @clerk/react, lucide-react, react, react-dom, @tailwindcss/vite, @vercel/analytics (+23 more)

### Community 11 - "reviewer-portal/package.json"
Cohesion: 0.07
Nodes (27): dependencies, lucide-react, react, react-dom, @tailwindcss/vite, devDependencies, tailwindcss, typescript (+19 more)

### Community 12 - "admin-portal/src/App.tsx"
Cohesion: 0.06
Nodes (41): App(), Author, AuthorDraft, EditAuthorsModal(), FileView, formatDate(), formatDateTime(), mailStatusBadge() (+33 more)

### Community 13 - "reviewer-portal/src/App.tsx"
Cohesion: 0.12
Nodes (16): App(), Author, CameraReadyReviewEditor(), DECISION_META, decisionMeta(), FileView, formatDate(), formatDateTime() (+8 more)

### Community 14 - "ICAIDIET'26 — Codebase Notes"
Cohesion: 0.09
Nodes (22): 1. Shape of the thing, 2. Backend architecture notes, 3. Data model (D1, `icaidiet_text_records`), 4. Auth — three parallel systems, no shared session layer, 5. Business workflows (where the code is), 6. Frontend notes, 7. Commands, 8. Known issues / gotchas — check before you touch things (+14 more)

### Community 15 - "preparePhase2Submission"
Cohesion: 0.29
Nodes (7): ACCEPTED_STATUSES, ensureUserForClerk(), isAuthorizedForSubmission(), loadSettingsRecord(), PHASE2_EDITABLE_REVIEW_STATUSES, preparePhase2Submission(), registrationEligible()

### Community 16 - "backend/package.json"
Cohesion: 0.10
Nodes (19): dependencies, @clerk/backend, hono, devDependencies, @cloudflare/workers-types, typescript, wrangler, typescript (+11 more)

### Community 17 - "MailField.tsx"
Cohesion: 0.47
Nodes (5): applyTag(), FieldEl, MAIL_PLACEHOLDERS, MailField(), Tag

### Community 18 - "build_full_mapping.cjs"
Cohesion: 0.33
Nodes (4): distinct, fs, path, unmappedList

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+10 more)

### Community 22 - "verify-fee-snapshot.cjs"
Cohesion: 0.11
Nodes (15): base, expired, factory, fs, mod, movedWindow, noCutoff, path (+7 more)

### Community 23 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck (+8 more)

### Community 25 - "generate_docx_report.py"
Cohesion: 0.83
Nodes (3): create_report(), set_cell_background(), set_cell_margins()

### Community 27 - "storeFinalFile"
Cohesion: 0.67
Nodes (3): sanitizeFilename(), storeFinalFile(), validateFile()

### Community 42 - "cleanDisplayText"
Cohesion: 0.38
Nodes (7): cleanDisplayText(), isCalendarDate(), loadRegistrationConfig(), parseRegistrationConfig(), resolveFeeSnapshot(), staleAmountRefusal(), validateRegistrationConfig()

### Community 52 - "DownloadPanel.tsx"
Cohesion: 0.50
Nodes (4): DownloadPanel(), ExportColumn, ExportFilter, FILTER_GROUPS

### Community 57 - "MySubmissions.tsx"
Cohesion: 0.06
Nodes (38): ViewState, MainLayout(), MainLayoutProps, NAV_ITEMS, NavView, Popup(), PopupInfo, PopupProps (+30 more)

### Community 62 - "workspaces"
Cohesion: 0.25
Nodes (7): name, private, workspaces, admin-portal, backend, reviewer-portal, user-portal

### Community 64 - "verifyToken"
Cohesion: 0.29
Nodes (7): base64UrlDecode(), base64UrlEncode(), getAuthSecret(), getBearer(), requireReviewerAuth(), signToken(), verifyToken()

### Community 71 - "userPortalGate"
Cohesion: 0.33
Nodes (6): approvedMailAllowed(), approvedMailIdList(), approvedMailListEnabled(), paperAcceptanceOpen(), portalMaintenanceActive(), userPortalGate()

### Community 72 - "sendViaResend"
Cohesion: 0.20
Nodes (10): convertLinksToAnchor(), mailHtmlBody(), mailHtmlToText(), mailPlaceholderValue(), processMailQueue(), purgeExpiredDeleted(), renderMailBody(), scheduled() (+2 more)

### Community 85 - "buildZip"
Cohesion: 0.40
Nodes (5): buildZip(), crc32(), generateXlsx(), xlsxColLetter(), zipDateTime()

### Community 86 - "resolveClerkEmail"
Cohesion: 0.50
Nodes (5): clerkEmailFromBackendApi(), normalizeResolvedEmail(), requireClerkAuth(), resolveClerkEmail(), verifyClerkJwt()

### Community 106 - "Agent instructions — ICAIDIET'26 conference portal"
Cohesion: 0.50
Nodes (3): Agent instructions — ICAIDIET'26 conference portal, "Deploy to Cloudflare", Notes

## Knowledge Gaps
- **310 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+305 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `name`, `private`, `version` to the rest of the system?**
  _310 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RpcTarget` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `WorkerEntrypoint` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04440333024976873 - nodes in this community are weakly interconnected._
- **Should `admin-portal/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `user-portal/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `reviewer-portal/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._