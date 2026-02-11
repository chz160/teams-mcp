# Implementation Plan: Read-Only Permissions Mode

**Branch**: `001-read-only-mode` | **Date**: 2026-02-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-read-only-mode/spec.md`

## Summary

Add a read-only operating mode to teams-mcp, activated via the `TEAMS_MCP_READ_ONLY` environment variable. When enabled, the server requests only read-level Microsoft Graph permissions and registers only read-oriented MCP tools (15 of 19), excluding the 4 write tools (`send_chat_message`, `create_chat`, `send_channel_message`, `reply_to_channel_message`). The mode is communicated through startup logs and the `auth_status` tool response. Full backward compatibility is maintained when the environment variable is not set.

## Technical Context

**Language/Version**: TypeScript 5.9, ESM-only (`"type": "module"` in package.json)
**Primary Dependencies**: `@modelcontextprotocol/sdk`, `@microsoft/microsoft-graph-client`, `@azure/msal-node`, `zod`
**Storage**: File-based token cache (`~/.teams-mcp-token-cache.json`, `~/.msgraph-mcp-auth.json`)
**Testing**: Vitest with MSW (Mock Service Worker), 80% coverage threshold
**Target Platform**: Node.js v20, v22, v24 (cross-platform CLI tool)
**Project Type**: Single project (CLI + MCP server)
**Performance Goals**: N/A — no performance-sensitive changes
**Constraints**: Must maintain backward compatibility; no new dependencies
**Scale/Scope**: 6 files modified, 0 new production files, 1-2 new test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Strict TypeScript & ESM-First | PASS | No changes to TS config. New code follows existing patterns. `.js` extensions in imports maintained. |
| II. Consistent API Contracts | PASS | `auth_status` response remains `{ content: [{ type: "text", text: string }] }`. Only the text content string changes (appends mode indicator). |
| III. Test Coverage & Isolation | PASS | New tests required for: mode detection, conditional tool registration, scopes selection, auth_status mode response. Follows established mock patterns. |
| IV. Security by Default | PASS | This feature **enhances** least-privilege by allowing reduced scopes. No new security surface. |
| V. Bounded Resource Consumption | PASS | No pagination or API call changes. |
| VI. Singleton Services & Registration Patterns | PASS | `GraphService` singleton preserved. `register*Tools()` signature extended with optional `readOnly` param (backward compatible). Registration order unchanged. |
| VII. Minimal Tooling Surface | PASS | No new dependencies. No tooling changes. |

**Post-Phase 1 re-check**: All principles still satisfied. The `readOnly` parameter is optional with default `false`, preserving backward compatibility of all register function signatures.

## Project Structure

### Documentation (this feature)

```text
specs/001-read-only-mode/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Permission sets and tool classification
├── quickstart.md        # User-facing configuration guide
├── contracts/
│   └── function-signatures.md  # Modified function contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── index.ts                      # MODIFIED: isReadOnlyMode(), getDelegatedScopes(), mode-aware startup
├── services/
│   └── graph.ts                  # MODIFIED: getDelegatedScopes(), mode-aware token acquisition
├── tools/
│   ├── auth.ts                   # MODIFIED: readOnly param, mode in auth_status response
│   ├── chats.ts                  # MODIFIED: readOnly param, conditional write tool registration
│   ├── teams.ts                  # MODIFIED: readOnly param, conditional write tool registration
│   ├── search.ts                 # UNCHANGED (all read tools)
│   ├── users.ts                  # UNCHANGED (all read tools)
│   └── __tests__/
│       ├── auth.test.ts          # MODIFIED: add read-only mode tests
│       ├── chats.test.ts         # MODIFIED: add read-only registration tests
│       ├── teams.test.ts         # MODIFIED: add read-only registration tests
│       └── read-only-mode.test.ts # NEW: integration tests for mode detection & scopes
└── test-utils/
    └── setup.ts                  # UNCHANGED
```

**Structure Decision**: Single project structure. This feature modifies existing files with minimal additions. No new production source files are needed — the `isReadOnlyMode()` and `getDelegatedScopes()` helpers live in the existing `index.ts` and `graph.ts` files.

## Complexity Tracking

No constitution violations. No complexity justifications needed.

## Implementation Summary

### Changes by File

#### `src/index.ts`

1. Add `isReadOnlyMode()` helper function that reads `process.env.TEAMS_MCP_READ_ONLY`
2. Add `getDelegatedScopes(readOnly: boolean)` function returning appropriate scope array
3. Replace static `DELEGATED_SCOPES` usage in `authenticate()` with `getDelegatedScopes(isReadOnlyMode())`
4. In `startMcpServer()`: read mode, pass `readOnly` to register functions that have write tools (`registerAuthTools`, `registerTeamsTools`, `registerChatTools`), emit mode-specific startup log

#### `src/services/graph.ts`

1. Add `getDelegatedScopes(readOnly: boolean)` function (same logic as index.ts)
2. Add `isReadOnlyMode()` helper (same logic)
3. Replace static `DELEGATED_SCOPES` references in `initializeClient()` and `acquireToken()` with `getDelegatedScopes(isReadOnlyMode())`

#### `src/tools/auth.ts`

1. Add optional `readOnly` parameter (default `false`)
2. When `readOnly` is `true`, append ` [Read-Only Mode]` to the authenticated status message

#### `src/tools/chats.ts`

1. Add optional `readOnly` parameter (default `false`)
2. Wrap `send_chat_message` and `create_chat` registration in `if (!readOnly)` block

#### `src/tools/teams.ts`

1. Add optional `readOnly` parameter (default `false`)
2. Wrap `send_channel_message` and `reply_to_channel_message` registration in `if (!readOnly)` block

#### Test Files

1. `src/tools/__tests__/read-only-mode.test.ts` (NEW): Tests for `isReadOnlyMode()` with various env var values, `getDelegatedScopes()` output for both modes
2. `src/tools/__tests__/auth.test.ts` (MODIFIED): Add tests for auth_status with read-only mode indicator
3. `src/tools/__tests__/chats.test.ts` (MODIFIED): Add test verifying only 2 tools registered when `readOnly=true`
4. `src/tools/__tests__/teams.test.ts` (MODIFIED): Add test verifying only 6 tools registered when `readOnly=true`
