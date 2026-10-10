# Graph Report - conference-portal  (2026-10-08)

## Corpus Check
- 66 files · ~331,173 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2263 nodes · 2430 edges · 182 communities (42 shown, 140 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.73)
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
- Event
- ServiceWorkerGlobalScope
- admin-portal/package.json
- paymentOcr.ts
- user-portal/package.json
- reviewer-portal/package.json
- admin-portal/src/App.tsx
- reviewer-portal/src/App.tsx
- ICAIDIET'26 — Codebase Notes
- Console
- backend/package.json
- TransformStream
- URL
- compilerOptions
- compilerOptions
- compilerOptions
- verify-fee-snapshot.cjs
- compilerOptions
- worker-configuration.d.ts
- NonRetryableError
- Pipeline
- URLSearchParams
- Container
- PipelineTransformationEntrypoint
- DurableObjectStorage
- Body
- Element
- Headers
- SubtleCrypto
- Blob
- FormData
- DurableObjectState
- URLPattern
- StreamError
- Flagship
- R2ObjectBody
- cleanDisplayText
- AgentMemoryProfile
- ByteLengthQueuingStrategy
- WritableStream
- WorkflowStep
- DurableObjectTransaction
- EventSource
- ReadableStream
- Socket
- WritableStreamDefaultWriter
- DownloadPanel.tsx
- AiSearchInstance
- SubmissionWizard.tsx
- DurableObjectNamespace
- user-portal/src/App.tsx
- MySubmissions.tsx
- R2Bucket
- SqlStorageCursor
- Vectorize
- WorkflowInstance
- workspaces
- App
- verifyToken
- D1Database
- Ai
- AiSearchNamespace
- ReadableStreamBYOBReader
- VectorizeIndex
- MailField.tsx
- userPortalGate
- sendViaResend
- AiSearchItem
- AiSearchItems
- Artifacts
- ArtifactsRepo
- D1PreparedStatement
- ImageHandle
- KVNamespace
- ReadableByteStreamController
- ReadableStreamBYOBRequest
- ReadableStreamDefaultReader
- Span
- TextDecoder
- buildZip
- resolveClerkEmail
- AiGateway
- Comment
- Disposable
- DurableObjectFacets
- ForwardableEmailMessage
- HostedImagesBinding
- HTMLRewriter
- HTMLRewriterDocumentContentHandlers
- ReadableStreamDefaultController
- StreamScopedCaptions
- StreamVideoHandle
- StreamWatermarks
- SyncKvStorage
- Table
- Text
- TextEncoder
- Tracing
- TransformStreamDefaultController
- Workflow
- Agent instructions — ICAIDIET'26 conference portal
- AbortController
- AiSearchJob
- AiSearchJobs
- AutoRAG
- Cache
- Crypto
- D1DatabaseSession
- EndTag
- ExecProcess
- ExecutionContext
- HTMLRewriterElementContentHandlers
- ImagesBinding
- ImageTransformationResult
- ImageTransformer
- MediaTransformationResult
- Module
- Queue
- R2MultipartUpload
- StreamBinding
- StreamScopedDownloads
- WebSocketRequestResponsePair
- admin-portal/src/vite-env.d.ts
- AgentMemoryNamespace
- BasicImageTransformations
- BrowserRun
- ColoLocalActorNamespace
- DOMException
- DurableObjectId
- Global
- HelloWorldBinding
- HyperdriveDynamicApi
- MediaTransformer
- Memory
- Message
- MessageBatch
- NodeStyleServer
- RequestInitCfPropertiesVaryHeader
- SqlStorage
- ToMarkdownService
- WorkerLoader
- WorkerStub
- WritableStreamDefaultController
- reviewer-portal/src/vite-env.d.ts
- user-portal/src/vite-env.d.ts
- AnalyticsEngineDataset
- __BaseEnv_Env
- CacheContext
- CacheStorage
- CloudflareAccessContext
- CompileError
- DispatchNamespace
- DocumentEnd
- EventListenerObject
- Hyperdrive
- IncomingRequestCfPropertiesBotManagement
- Instance
- JsonWebKey
- MediaBinding
- MediaTransformationGenerator
- Navigator
- R2Checksums
- RateLimit
- ResponseFunctionToolCall
- RuntimeError
- ScheduledController
- Scheduler
- SecretsStoreSecret
- SendEmail
- StreamVideos
- TraceItemFetchEventInfoRequest
- UnsafeTraceMetrics
- WebSearch

## God Nodes (most connected - your core abstractions)
1. `Event` - 25 edges
2. `Console` - 21 edges
3. `URLSearchParams` - 16 edges
4. `compilerOptions` - 15 edges
5. `DurableObjectStorage` - 15 edges
6. `Container` - 15 edges
7. `compilerOptions` - 15 edges
8. `compilerOptions` - 15 edges
9. `SubtleCrypto` - 14 edges
10. `Element` - 14 edges

## Surprising Connections (you probably didn't know these)
- `scanProofOcr()` --calls--> `upsertOcrRow()`  [EXTRACTED]
  backend/src/paymentOcr.ts → backend/src/paymentOcr.ts  _Bridges community 9 → community 65_
- `EventSource` --inherits--> `EventTarget`  [EXTRACTED]
  backend/worker-configuration.d.ts → backend/worker-configuration.d.ts  _Bridges community 7 → community 48_

## Import Cycles
- None detected.

## Communities (182 total, 140 thin omitted)

### Community 4 - "RegistrationConfigPanel.tsx"
Cohesion: 0.29
Nodes (9): BANK_FIELDS, BankAccount, configToRows(), FeeRow, formatCutoffForHumans(), getInitialBanks(), RegistrationConfig, RegistrationConfigPanel() (+1 more)

### Community 5 - "index.ts"
Cohesion: 0.04
Nodes (33): ALLOWED_SUBMISSION_STATUSES, ALLOWED_TYPES, app, AppEnv, BankDetails, Bindings, clerkEmailCache, clientIp() (+25 more)

### Community 6 - "Event"
Cohesion: 0.04
Nodes (12): CloseEvent, CustomEvent, EmailEvent, ErrorEvent, Event, ExtendableEvent, FetchEvent, MessageEvent (+4 more)

### Community 7 - "ServiceWorkerGlobalScope"
Cohesion: 0.06
Nodes (6): AbortSignal, EventTarget, MessagePort, ServiceWorkerGlobalScope, WebSocket, WorkerGlobalScope

### Community 8 - "admin-portal/package.json"
Cohesion: 0.06
Nodes (31): dependencies, lucide-react, react, react-dom, @tailwindcss/vite, devDependencies, tailwindcss, @types/react (+23 more)

### Community 9 - "paymentOcr.ts"
Cohesion: 0.12
Nodes (25): collectGroups(), describeOcrError(), DuplicateGroup, DuplicateReason, DuplicateReasonCode, findDuplicatePaymentGroups(), findProofsNeedingScan(), normalizeOcrText() (+17 more)

### Community 10 - "user-portal/package.json"
Cohesion: 0.06
Nodes (31): @clerk/react, dependencies, @clerk/react, lucide-react, react, react-dom, @tailwindcss/vite, @vercel/analytics (+23 more)

### Community 11 - "reviewer-portal/package.json"
Cohesion: 0.07
Nodes (27): dependencies, lucide-react, react, react-dom, @tailwindcss/vite, devDependencies, tailwindcss, typescript (+19 more)

### Community 12 - "admin-portal/src/App.tsx"
Cohesion: 0.12
Nodes (21): Author, AuthorDraft, EditAuthorsModal(), FileView, formatDateTime(), mailStatusBadge(), MailTemplate, MoreInfoModal() (+13 more)

### Community 13 - "reviewer-portal/src/App.tsx"
Cohesion: 0.12
Nodes (15): App(), Author, DECISION_META, decisionMeta(), FileView, formatDate(), formatDateTime(), matchesSearch() (+7 more)

### Community 14 - "ICAIDIET'26 — Codebase Notes"
Cohesion: 0.09
Nodes (22): 1. Shape of the thing, 2. Backend architecture notes, 3. Data model (D1, `icaidiet_text_records`), 4. Auth — three parallel systems, no shared session layer, 5. Business workflows (where the code is), 6. Frontend notes, 7. Commands, 8. Known issues / gotchas — check before you touch things (+14 more)

### Community 16 - "backend/package.json"
Cohesion: 0.10
Nodes (19): dependencies, @clerk/backend, hono, devDependencies, @cloudflare/workers-types, typescript, wrangler, typescript (+11 more)

### Community 17 - "TransformStream"
Cohesion: 0.10
Nodes (7): CompressionStream, DecompressionStream, FixedLengthStream, IdentityTransformStream, TextDecoderStream, TextEncoderStream, TransformStream

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

### Community 24 - "worker-configuration.d.ts"
Cohesion: 0.00
Nodes (885): AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions, AgentMemoryListMemoriesOptions, AgentMemoryListMemoriesResult, AgentMemoryMemory, AgentMemoryMemoryListEntry (+877 more)

### Community 31 - "Body"
Cohesion: 0.14
Nodes (4): Body, Request, Response, EditFilesModal()

### Community 39 - "StreamError"
Cohesion: 0.18
Nodes (11): AlreadyUploadedError, BadRequestError, ForbiddenError, InternalError, InvalidURLError, MaxFileSizeError, NotFoundError, QuotaReachedError (+3 more)

### Community 42 - "cleanDisplayText"
Cohesion: 0.28
Nodes (9): cleanDisplayText(), isCalendarDate(), loadRegistrationConfig(), loadSettingsRecord(), parseRegistrationConfig(), registrationEligible(), resolveFeeSnapshot(), staleAmountRefusal() (+1 more)

### Community 44 - "ByteLengthQueuingStrategy"
Cohesion: 0.22
Nodes (3): ByteLengthQueuingStrategy, CountQueuingStrategy, QueuingStrategy

### Community 52 - "DownloadPanel.tsx"
Cohesion: 0.29
Nodes (6): PdfViewer(), DownloadPanel(), ExportColumn, ExportFilter, FILTER_GROUPS, PdfViewer()

### Community 54 - "SubmissionWizard.tsx"
Cohesion: 0.31
Nodes (6): Popup(), PopupInfo, PopupProps, onlyDigits(), SubmissionWizard(), SubmissionWizardProps

### Community 56 - "user-portal/src/App.tsx"
Cohesion: 0.15
Nodes (7): ViewState, MainLayout(), MainLayoutProps, NAV_ITEMS, NavView, HeroSection(), RegistrationConfig

### Community 57 - "MySubmissions.tsx"
Cohesion: 0.15
Nodes (19): asJpgName(), BankAccount, canvasToJpeg(), compressProofForOcr(), FALLBACK_REGISTRATION, formatCutoffDate(), formatDate(), isPayablePaper() (+11 more)

### Community 62 - "workspaces"
Cohesion: 0.25
Nodes (7): name, private, workspaces, admin-portal, backend, reviewer-portal, user-portal

### Community 63 - "App"
Cohesion: 0.29
Nodes (4): App(), formatDate(), matchesSearch(), Performance

### Community 64 - "verifyToken"
Cohesion: 0.29
Nodes (7): base64UrlDecode(), base64UrlEncode(), getAuthSecret(), getBearer(), requireReviewerAuth(), signToken(), verifyToken()

### Community 70 - "MailField.tsx"
Cohesion: 0.47
Nodes (5): applyTag(), FieldEl, MAIL_PLACEHOLDERS, MailField(), Tag

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

### Community 89 - "Disposable"
Cohesion: 0.40
Nodes (3): Disposable, HyperdriveDynamic, StubBase

### Community 106 - "Agent instructions — ICAIDIET'26 conference portal"
Cohesion: 0.50
Nodes (3): Agent instructions — ICAIDIET'26 conference portal, "Deploy to Cloudflare", Notes

### Community 130 - "BasicImageTransformations"
Cohesion: 0.67
Nodes (3): BasicImageTransformations, RequestInitCfPropertiesImage, RequestInitCfPropertiesImageDraw

### Community 143 - "RequestInitCfPropertiesVaryHeader"
Cohesion: 0.67
Nodes (3): RequestInitCfPropertiesVaryAcceptHeader, RequestInitCfPropertiesVaryAcceptLanguageHeader, RequestInitCfPropertiesVaryHeader

## Knowledge Gaps
- **1122 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+1117 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **140 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `D1PreparedStatement` connect `D1PreparedStatement` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `findDuplicatePaymentGroups()` connect `paymentOcr.ts` to `D1PreparedStatement`, `index.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `Body` connect `Body` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _1122 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04421768707482993 - nodes in this community are weakly interconnected._
- **Should `Event` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `ServiceWorkerGlobalScope` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._