# Graph Report - conference-portal  (2026-10-08)

## Corpus Check
- 62 files · ~263,699 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 478 nodes · 576 edges · 32 communities (28 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `88243ca5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DurableObject
- RpcTarget
- WorkerEntrypoint
- WorkflowEntrypoint
- RegistrationConfigPanel.tsx
- index.ts
- admin-portal/package.json
- paymentOcr.ts
- user-portal/package.json
- reviewer-portal/package.json
- admin-portal/src/App.tsx
- reviewer-portal/src/App.tsx
- ICAIDIET'26 — Codebase Notes
- backend/package.json
- compilerOptions
- compilerOptions
- compilerOptions
- verify-fee-snapshot.cjs
- compilerOptions
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
5. `ICAIDIET'26 — Codebase Notes` - 10 edges
6. `MySubmissions()` - 8 edges
7. `formatDateTime()` - 7 edges
8. `scanProofOcr()` - 7 edges
9. `6. Frontend notes` - 7 edges
10. `ReviewSection()` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (32 total, 4 thin omitted)

### Community 4 - "RegistrationConfigPanel.tsx"
Cohesion: 0.29
Nodes (9): BANK_FIELDS, BankAccount, configToRows(), FeeRow, formatCutoffForHumans(), getInitialBanks(), RegistrationConfig, RegistrationConfigPanel() (+1 more)

### Community 5 - "index.ts"
Cohesion: 0.05
Nodes (25): ALLOWED_SUBMISSION_STATUSES, ALLOWED_TYPES, app, AppEnv, BankDetails, Bindings, clerkEmailCache, CRC_TABLE (+17 more)

### Community 8 - "admin-portal/package.json"
Cohesion: 0.06
Nodes (31): dependencies, lucide-react, react, react-dom, @tailwindcss/vite, devDependencies, tailwindcss, @types/react (+23 more)

### Community 9 - "paymentOcr.ts"
Cohesion: 0.11
Nodes (26): collectGroups(), describeOcrError(), DuplicateGroup, DuplicateReason, DuplicateReasonCode, findDuplicatePaymentGroups(), findProofsNeedingScan(), normalizeOcrText() (+18 more)

### Community 10 - "user-portal/package.json"
Cohesion: 0.06
Nodes (31): @clerk/react, dependencies, @clerk/react, lucide-react, react, react-dom, @tailwindcss/vite, @vercel/analytics (+23 more)

### Community 11 - "reviewer-portal/package.json"
Cohesion: 0.07
Nodes (27): dependencies, lucide-react, react, react-dom, @tailwindcss/vite, devDependencies, tailwindcss, typescript (+19 more)

### Community 12 - "admin-portal/src/App.tsx"
Cohesion: 0.09
Nodes (29): App(), Author, AuthorDraft, EditAuthorsModal(), FileView, formatDate(), formatDateTime(), mailStatusBadge() (+21 more)

### Community 13 - "reviewer-portal/src/App.tsx"
Cohesion: 0.12
Nodes (15): App(), Author, DECISION_META, decisionMeta(), FileView, formatDate(), formatDateTime(), matchesSearch() (+7 more)

### Community 14 - "ICAIDIET'26 — Codebase Notes"
Cohesion: 0.09
Nodes (22): 1. Shape of the thing, 2. Backend architecture notes, 3. Data model (D1, `icaidiet_text_records`), 4. Auth — three parallel systems, no shared session layer, 5. Business workflows (where the code is), 6. Frontend notes, 7. Commands, 8. Known issues / gotchas — check before you touch things (+14 more)

### Community 16 - "backend/package.json"
Cohesion: 0.10
Nodes (19): dependencies, @clerk/backend, hono, devDependencies, @cloudflare/workers-types, typescript, wrangler, typescript (+11 more)

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

### Community 42 - "cleanDisplayText"
Cohesion: 0.28
Nodes (9): cleanDisplayText(), isCalendarDate(), loadRegistrationConfig(), loadSettingsRecord(), parseRegistrationConfig(), registrationEligible(), resolveFeeSnapshot(), staleAmountRefusal() (+1 more)

### Community 52 - "DownloadPanel.tsx"
Cohesion: 0.50
Nodes (4): DownloadPanel(), ExportColumn, ExportFilter, FILTER_GROUPS

### Community 57 - "MySubmissions.tsx"
Cohesion: 0.06
Nodes (32): ViewState, MainLayout(), MainLayoutProps, NAV_ITEMS, NavView, Popup(), PopupInfo, PopupProps (+24 more)

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
Cohesion: 0.33
Nodes (6): mailHtmlBody(), mailHtmlToText(), processMailQueue(), purgeExpiredDeleted(), scheduled(), sendViaResend()

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
- **231 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+226 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scanProofOcr()` connect `paymentOcr.ts` to `index.ts`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _231 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `admin-portal/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `paymentOcr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11396011396011396 - nodes in this community are weakly interconnected._
- **Should `user-portal/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `reviewer-portal/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._