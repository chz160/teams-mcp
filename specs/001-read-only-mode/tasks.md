# Tasks: Read-Only Permissions Mode

**Input**: Design documents from `/specs/001-read-only-mode/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — required to maintain the 80% coverage threshold per project constitution.

**Organization**: Tasks are grouped by user story. US1 and US2 are combined into a single phase because they are co-dependent (the env var mechanism IS the configuration for read-only mode).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root

---

## Phase 1: Foundational (Shared Helpers)

**Purpose**: Create the mode detection and scope selection helpers that all user stories depend on

- [ ] T001 Add `isReadOnlyMode()` helper function that reads `TEAMS_MCP_READ_ONLY` env var and returns boolean (truthy values: `"true"`, `"1"`, `"yes"` case-insensitive) in `src/index.ts`
- [ ] T002 Add `getDelegatedScopes(readOnly: boolean)` helper function that returns the full-access scope array when `false` and the read-only scope array (excluding `ChannelMessage.Send`, replacing `Chat.ReadWrite` with `Chat.Read`) when `true` in `src/index.ts`
- [ ] T003 [P] Add `isReadOnlyMode()` and `getDelegatedScopes(readOnly: boolean)` helper functions with identical logic in `src/services/graph.ts`

**Checkpoint**: Helper functions available — user story implementation can now begin

---

## Phase 2: User Story 1+2 — Read-Only Mode Core (Priority: P1) MVP

**Goal**: When `TEAMS_MCP_READ_ONLY` is set to a truthy value, the server registers only read tools and requests only read-level Graph permissions. When unset, behavior is identical to current implementation.

**Independent Test**: Start server with `TEAMS_MCP_READ_ONLY=true`, verify only 15 read tools are registered (no `send_chat_message`, `create_chat`, `send_channel_message`, `reply_to_channel_message`). Start server without the env var and verify all 19 tools are registered.

### Implementation

- [ ] T004 [P] [US1] Add optional `readOnly = false` parameter to `registerChatTools()` and wrap `send_chat_message` and `create_chat` registration in `if (!readOnly)` block in `src/tools/chats.ts`
- [ ] T005 [P] [US1] Add optional `readOnly = false` parameter to `registerTeamsTools()` and wrap `send_channel_message` and `reply_to_channel_message` registration in `if (!readOnly)` block in `src/tools/teams.ts`
- [ ] T006 [US1] Update `startMcpServer()` to call `isReadOnlyMode()`, store result, and pass `readOnly` to `registerAuthTools()`, `registerTeamsTools()`, and `registerChatTools()` in `src/index.ts`
- [ ] T007 [US2] Replace static `DELEGATED_SCOPES` usage in `authenticate()` with `getDelegatedScopes(isReadOnlyMode())` in `src/index.ts`
- [ ] T008 [US2] Replace static `DELEGATED_SCOPES` usage in `initializeClient()` and `acquireToken()` with `getDelegatedScopes(isReadOnlyMode())` in `src/services/graph.ts`

### Tests

- [ ] T009 [P] [US1] Add test verifying `registerChatTools(server, graphService, true)` registers only 2 tools (`list_chats`, `get_chat_messages`) in `src/tools/__tests__/chats.test.ts`
- [ ] T010 [P] [US1] Add test verifying `registerChatTools(server, graphService, false)` still registers all 4 tools (backward compatibility) in `src/tools/__tests__/chats.test.ts`
- [ ] T011 [P] [US1] Add test verifying `registerTeamsTools(server, graphService, true)` registers only 6 read tools (excludes `send_channel_message`, `reply_to_channel_message`) in `src/tools/__tests__/teams.test.ts`
- [ ] T012 [P] [US1] Add test verifying `registerTeamsTools(server, graphService, false)` still registers all 8 tools (backward compatibility) in `src/tools/__tests__/teams.test.ts`
- [ ] T013 [P] [US2] Create `src/tools/__tests__/read-only-mode.test.ts` with tests for `isReadOnlyMode()`: returns `true` for `"true"`, `"1"`, `"yes"`, `"TRUE"`, `"Yes"`; returns `false` for `"false"`, `"0"`, `""`, `undefined`
- [ ] T014 [P] [US2] Add tests for `getDelegatedScopes()`: verify full-access array includes `ChannelMessage.Send` and `Chat.ReadWrite`; verify read-only array excludes them and includes `Chat.Read` in `src/tools/__tests__/read-only-mode.test.ts`

**Checkpoint**: Read-only mode fully functional. Server conditionally registers tools and requests correct scopes based on env var.

---

## Phase 3: User Story 3 — Clear Feedback on Active Mode (Priority: P2)

**Goal**: Users and AI assistants receive clear indication of which mode the server is operating in, via startup logs and the `auth_status` tool response.

**Independent Test**: Start server with `TEAMS_MCP_READ_ONLY=true`, verify startup log says "read-only mode". Check `auth_status` tool response includes `[Read-Only Mode]`. Start without env var and verify standard log with no mode indicator.

### Implementation

- [ ] T015 [P] [US3] Add optional `readOnly = false` parameter to `registerAuthTools()` and append ` [Read-Only Mode]` to authenticated status message when `readOnly` is `true` in `src/tools/auth.ts`
- [ ] T016 [US3] Add mode-aware startup log in `startMcpServer()`: log `"Microsoft Graph MCP Server started (read-only mode)"` when read-only, otherwise keep existing `"Microsoft Graph MCP Server started"` message in `src/index.ts`

### Tests

- [ ] T017 [P] [US3] Add test verifying `auth_status` response includes `[Read-Only Mode]` when `registerAuthTools(server, graphService, true)` in `src/tools/__tests__/auth.test.ts`
- [ ] T018 [P] [US3] Add test verifying `auth_status` response does NOT include `[Read-Only Mode]` when `registerAuthTools(server, graphService, false)` (backward compatibility) in `src/tools/__tests__/auth.test.ts`

**Checkpoint**: All user stories independently functional. Mode is clearly communicated.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Validate everything works together, meets quality gates

- [ ] T019 Run full test suite (`npm test`) and verify all existing tests pass unchanged
- [ ] T020 Run coverage check (`npm run test:coverage`) and verify 80% threshold met
- [ ] T021 Run linter (`npm run lint:fix`) and fix any issues
- [ ] T022 Run TypeScript compilation (`npm run compile`) and verify zero type errors
- [ ] T023 Run build (`npm run build`) and verify clean output
- [ ] T024 Verify CLI smoke test: `node dist/index.js --help` runs without error

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately
- **US1+US2 Core (Phase 2)**: Depends on Phase 1 (helpers must exist first)
- **US3 Feedback (Phase 3)**: Depends on Phase 1 (uses `readOnly` flag). Can run in parallel with Phase 2 since it touches different files (`auth.ts` vs `chats.ts`/`teams.ts`)
- **Polish (Phase 4)**: Depends on all previous phases

### User Story Dependencies

- **US1+US2 (P1)**: Depends on Foundational helpers. No dependency on US3.
- **US3 (P2)**: Depends on Foundational helpers. Can be implemented independently of US1+US2 since it modifies `auth.ts` (not `chats.ts` or `teams.ts`). However, the `readOnly` parameter flow through `startMcpServer()` (T006) should be done first.

### Within Each Phase

- T004 and T005 can run in parallel (different files: `chats.ts` vs `teams.ts`)
- T007 and T008 can run in parallel (different files: `index.ts` vs `graph.ts`)
- All test tasks marked [P] within a phase can run in parallel (different test files)
- T006 depends on T004 and T005 (needs the modified function signatures to call)

### Parallel Opportunities

```
Phase 1: T001 → T002 (sequential, same file)
          T003 (parallel with T001+T002, different file)

Phase 2: T004 ──┐
          T005 ──┤──→ T006 → T007
                 │           T008 (parallel with T007, different file)
          T009-T014 (all parallel, different test files or independent test blocks)

Phase 3: T015 ──→ T016 (T016 modifies same file as T006, so sequential)
          T017, T018 (parallel, test file)
```

---

## Parallel Example: Phase 2 (US1+US2 Core)

```bash
# Launch parallel implementation tasks (different files):
Task: "Add readOnly param to registerChatTools() in src/tools/chats.ts"          # T004
Task: "Add readOnly param to registerTeamsTools() in src/tools/teams.ts"         # T005

# After T004+T005 complete, launch sequential:
Task: "Update startMcpServer() to pass readOnly flag in src/index.ts"            # T006

# Then launch parallel scope updates (different files):
Task: "Update authenticate() scopes in src/index.ts"                             # T007
Task: "Update graph.ts scopes in src/services/graph.ts"                          # T008

# Launch all tests in parallel (independent test files/blocks):
Task: "Test chat read-only registration in src/tools/__tests__/chats.test.ts"    # T009
Task: "Test chat full-access registration in src/tools/__tests__/chats.test.ts"  # T010
Task: "Test teams read-only registration in src/tools/__tests__/teams.test.ts"   # T011
Task: "Test teams full-access registration in src/tools/__tests__/teams.test.ts" # T012
Task: "Test isReadOnlyMode() in src/tools/__tests__/read-only-mode.test.ts"      # T013
Task: "Test getDelegatedScopes() in src/tools/__tests__/read-only-mode.test.ts"  # T014
```

---

## Implementation Strategy

### MVP First (US1+US2 Only)

1. Complete Phase 1: Foundational helpers
2. Complete Phase 2: US1+US2 Core (conditional registration + scopes)
3. **STOP and VALIDATE**: Run `npm test`, `npm run build`, verify read-only mode works
4. This alone delivers the full value: read-only mode is functional

### Incremental Delivery

1. Phase 1 (Foundational) → Helpers ready
2. Phase 2 (US1+US2) → Read-only mode works → **MVP deployable**
3. Phase 3 (US3) → Clear feedback added → Better UX
4. Phase 4 (Polish) → All quality gates pass → **Release ready**

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are combined because the env var (US2) IS the mechanism for read-only mode (US1) — they cannot be tested independently
- All `register*Tools()` signature changes use optional params with defaults, ensuring zero breaking changes
- Existing test assertions (e.g., `expect(mockServer.tool).toHaveBeenCalledTimes(4)` in chats.test.ts) continue to pass because default `readOnly=false` preserves current behavior
- The `isReadOnlyMode()` and `getDelegatedScopes()` functions are duplicated in `index.ts` and `graph.ts` per research decision R2 — centralizing is a valid future refactor but not in scope
