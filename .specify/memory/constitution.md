<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0 (initial ratification)
  Added principles:
    - I. Strict TypeScript & ESM-First
    - II. Consistent API Contracts
    - III. Test Coverage & Isolation
    - IV. Security by Default
    - V. Bounded Resource Consumption
    - VI. Singleton Services & Registration Patterns
    - VII. Minimal Tooling Surface
  Added sections:
    - Performance & Reliability Standards
    - Quality Gates & CI Pipeline
    - Governance
  Templates requiring updates:
    - .specify/templates/plan-template.md — ✅ no updates needed (Constitution Check section is generic)
    - .specify/templates/spec-template.md — ✅ no updates needed (requirements/success criteria are generic)
    - .specify/templates/tasks-template.md — ✅ no updates needed (phase structure is generic)
  Follow-up TODOs: None
-->

# teams-mcp Constitution

## Core Principles

### I. Strict TypeScript & ESM-First

All source code MUST be written in TypeScript with the project's strict
compiler configuration enforced. This includes `noUnusedLocals`,
`noUnusedParameters`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
and `noImplicitReturns`.

The project is ESM-only (`"type": "module"` in package.json). All import
paths MUST use `.js` extensions even when referencing `.ts` source files.
Node.js built-in imports MUST use the `node:` protocol
(e.g., `import { promises as fs } from "node:fs"`).

Unused catch variables MUST be prefixed with underscore (`catch (_error)`).
Named imports MUST be preferred over default imports unless the module
explicitly exports a default.

**Rationale**: Strict typing catches API variability bugs at compile time.
ESM consistency prevents mixed-module resolution failures across Node
v20/v22/v24. These constraints are enforced by both `tsc` and Biome and
MUST NOT be relaxed.

### II. Consistent API Contracts

Every MCP tool MUST return success responses as
`{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`.

Every MCP tool MUST catch errors and return
`{ content: [{ type: "text", text: "❌ Error: ${errorMessage}" }] }`
where `errorMessage` is extracted via
`error instanceof Error ? error.message : "Unknown error occurred"`.

All tool input parameters MUST be validated with Zod schemas. Every
schema field MUST include a `.describe()` annotation for AI assistant
consumption. Tool names MUST use `snake_case`.

All Microsoft Graph response types MUST use `| undefined` for optional
properties to handle API variability (see `*Summary` interfaces in
`src/types/graph.ts`).

**Rationale**: AI assistants parse tool outputs programmatically.
Inconsistent response shapes break downstream integrations. Zod
descriptions become the tool's documentation for AI consumers.

### III. Test Coverage & Isolation

All production code MUST maintain >=80% coverage on branches, functions,
lines, and statements as enforced by `vitest.config.ts` thresholds.

Tests MUST use Vitest with global test APIs (`describe`, `it`, `expect`
without imports). HTTP interactions with Microsoft Graph MUST be mocked
using MSW (Mock Service Worker) handlers, never real API calls.

Tool tests MUST follow the established pattern: mock `McpServer` and
`GraphService` with `vi.fn()`, register tools against mocks, extract
handler functions from `mockServer.tool.mock.calls`, and invoke handlers
directly. See `src/tools/__tests__/chats.test.ts` as the canonical
reference.

Tests MUST run in isolated threads (`pool: "threads"`, `isolate: true`)
to prevent cross-test interference. MSW server MUST be started in
`beforeAll`, reset in `afterEach`, and stopped in `afterAll` via the
global setup at `src/test-utils/vitest.setup.ts`.

New tool modules MUST include corresponding test files in
`src/tools/__tests__/` covering success paths, error paths, and edge
cases before merging.

**Rationale**: The MCP server bridges AI assistants to a production
Microsoft 365 environment. Untested code paths risk sending malformed
messages or leaking data. Mocked HTTP ensures tests are deterministic and
fast without requiring Microsoft Graph credentials.

### IV. Security by Default

All user-supplied markdown content MUST be converted to HTML via `marked`
and then sanitized through `DOMPurify` before being sent to Microsoft
Teams. Only the allowlisted HTML tags and attributes defined in
`src/utils/markdown.ts` are permitted.

JWT tokens MUST be validated for structure (three-segment format) and
audience (`https://graph.microsoft.com`) before use. Token cache files
(`~/.teams-mcp-token-cache.json`, `~/.msgraph-mcp-auth.json`) MUST NOT
be committed to version control or logged.

OAuth scopes MUST follow least-privilege: request only the delegated
permissions defined in `DELEGATED_SCOPES` in `src/index.ts` and
`src/services/graph.ts`. New scopes MUST be justified in the PR
description.

**Rationale**: The server processes user content and sends it into
enterprise Teams channels. XSS, token leakage, and over-permissioned
scopes are high-impact risks in this context.

### V. Bounded Resource Consumption

All pagination loops (chat messages, channel messages, search results)
MUST enforce upper bounds: a maximum page count and a maximum item limit.
Unbounded `while` loops following `@odata.nextLink` are prohibited.

The `fetchAll` parameter pattern MUST be used to let callers opt into
extended pagination. Default behavior MUST return a single page of
results.

Client-side filtering (e.g., date range filtering on chat messages) MUST
only be applied when the Microsoft Graph API does not support server-side
equivalents. When applied, it MUST still respect pagination bounds.

Graph API batch requests and concurrent API calls MUST be bounded to
prevent throttling (HTTP 429) from Microsoft Graph.

**Rationale**: An MCP server runs as a long-lived subprocess. Unbounded
pagination or API fan-out can exhaust memory, trigger Graph throttling,
or cause the stdio transport to stall.

### VI. Singleton Services & Registration Patterns

`GraphService` MUST remain a singleton accessed via
`GraphService.getInstance()`. Direct instantiation MUST NOT be used
outside the class.

Every tool module MUST export a single `register*Tools(server, graphService)`
function. Tool handlers MUST obtain the Graph client via
`await graphService.getClient()` at invocation time (not at registration
time) to support lazy initialization and token refresh.

New tool modules MUST be registered in `src/index.ts` inside
`startMcpServer()`. The registration order MUST be: auth, users, teams,
chats, search (followed by any new modules).

**Rationale**: The singleton ensures a single MSAL token cache and Graph
client instance. Lazy client acquisition ensures expired tokens are
refreshed transparently. Consistent registration order makes the entry
point predictable.

### VII. Minimal Tooling Surface

**Biome** is the sole linting and formatting tool. ESLint and Prettier
MUST NOT be introduced. Biome configuration lives in `biome.json` at the
repository root.

Formatting rules: 2-space indent, LF line endings, 100-char line width,
double quotes, semicolons always, trailing commas in ES5 positions.

Dependencies MUST be kept minimal. `@types/*` packages that provide types
for runtime dependencies belong in `dependencies` (not `devDependencies`)
per the project's established convention. New runtime dependencies MUST
be justified and MUST pass `npm audit --audit-level moderate`.

**Rationale**: A single formatting/linting tool eliminates config drift
and conflicting rule sets. Minimal dependencies reduce supply chain risk
and keep the published npm package lean.

## Performance & Reliability Standards

- **Startup latency**: The MCP server MUST connect to stdio transport and
  be ready to accept tool calls without blocking on authentication.
  Token acquisition is deferred to first `getClient()` call.
- **Pagination defaults**: Default page sizes MUST match Microsoft Graph
  defaults (typically 20-50 items). Tools MUST NOT request more than
  100 items per page.
- **Max pagination depth**: Pagination loops MUST NOT exceed 100 pages
  unless explicitly overridden by a tool parameter.
- **Error recovery**: Token refresh failures MUST surface actionable error
  messages directing users to re-authenticate via the CLI.
- **Node.js compatibility**: All code MUST work on Node.js v20, v22, and
  v24 as validated by the CI matrix.

## Quality Gates & CI Pipeline

All pull requests targeting `main` MUST pass the following gates before
merge:

1. **Biome CI** (`npm run ci`): Zero warnings, zero errors.
2. **TypeScript compilation** (`npm run compile`): Zero type errors.
3. **Test suite** (`npm test`): All tests pass.
4. **Coverage thresholds**: >=80% on branches, functions, lines,
   statements.
5. **Build** (`npm run build`): Clean build produces `dist/` without
   errors.
6. **CLI smoke test**: `node dist/index.js --help` and
   `node dist/index.js check` execute without crashes.
7. **Security audit**: `npm audit --audit-level moderate` reports no
   vulnerabilities.

CI runs on Ubuntu with Node.js v20, v22, and v24. All matrix
combinations MUST pass.

Coverage is uploaded to Codecov. Test results are uploaded as JUnit XML
for Codecov Test Analytics.

Releases are tag-triggered via `.github/workflows/release.yml` using npm
trusted publishers (OpenID Connect). The `prepublishOnly` script
ensures a fresh build before every publish.

## Governance

This constitution is the authoritative source of project standards. All
code reviews and automated checks MUST verify compliance with these
principles.

**Amendment procedure**:
1. Propose changes via pull request modifying this file.
2. Document rationale for each change in the PR description.
3. At least one maintainer MUST approve.
4. Update the version number according to semver:
   - MAJOR: Principle removal or backward-incompatible redefinition.
   - MINOR: New principle or materially expanded guidance.
   - PATCH: Clarifications, wording, or non-semantic refinements.

**Compliance review**: Every PR MUST be checked against these principles.
The `CLAUDE.md` file provides runtime development guidance for AI
assistants and MUST remain consistent with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-02-11 | **Last Amended**: 2026-02-11
