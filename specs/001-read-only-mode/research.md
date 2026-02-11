# Research: Read-Only Permissions Mode

**Branch**: `001-read-only-mode` | **Date**: 2026-02-11

## R1: Microsoft Graph Read-Only Permission Scopes

**Decision**: In read-only mode, exclude `ChannelMessage.Send` entirely and replace `Chat.ReadWrite` with `Chat.Read`.

**Rationale**: The current `DELEGATED_SCOPES` array includes two write-level permissions:
- `ChannelMessage.Send` — required only for `send_channel_message` and `reply_to_channel_message`
- `Chat.ReadWrite` — required for `send_chat_message` and `create_chat`

The read-only scope set becomes:
```
User.Read, User.ReadBasic.All, Team.ReadBasic.All, Channel.ReadBasic.All,
ChannelMessage.Read.All, TeamMember.Read.All, Chat.ReadBasic, Chat.Read
```

Note: `Chat.ReadBasic` (already present) covers listing chats and metadata. `Chat.Read` (added) covers reading chat messages. Neither requires write access.

**Alternatives considered**:
- Removing `Chat.ReadBasic` in favor of just `Chat.Read`: Rejected — `Chat.ReadBasic` is a lower-privilege scope that some organizations grant more readily. Keeping both provides flexibility.
- Using `ChatMessage.Read.Chat` instead of `Chat.Read`: Rejected — this is a resource-specific consent scope and not applicable for delegated permissions in this context.

## R2: Dual Scope Definition Location

**Decision**: Both `src/index.ts` and `src/services/graph.ts` define `DELEGATED_SCOPES`. Both must be updated to support mode-aware scope selection.

**Rationale**: Investigation of the codebase reveals:
- `src/index.ts` line 28: `DELEGATED_SCOPES` used in the `authenticate()` CLI function for device code flow
- `src/services/graph.ts` line 8: `DELEGATED_SCOPES` used in `acquireTokenSilent()` for token refresh during MCP server operation

Both locations must use the same scope set based on the active mode. The environment variable `TEAMS_MCP_READ_ONLY` is readable from `process.env` in both locations.

**Alternatives considered**:
- Centralizing scopes in a single shared module: Clean but adds a new file for a small constant. Acceptable future refactor but not necessary now.
- Passing scopes as constructor argument to GraphService: Rejected — breaks singleton pattern and the established `getInstance()` contract.

## R3: Tool Registration Strategy

**Decision**: Pass a `readOnly: boolean` parameter to each `register*Tools()` function. Write tools are conditionally skipped inside the function body.

**Rationale**: The current architecture mixes read and write tools in the same registration function (`registerChatTools` registers 4 tools: 2 read, 2 write; `registerTeamsTools` registers 8 tools: 6 read, 2 write). Splitting into separate functions would require significant refactoring.

The conditional approach is minimally invasive:
```typescript
export function registerChatTools(server: McpServer, graphService: GraphService, readOnly = false) {
  // Always register read tools
  server.tool("list_chats", ...);
  server.tool("get_chat_messages", ...);

  // Only register write tools in full-access mode
  if (!readOnly) {
    server.tool("send_chat_message", ...);
    server.tool("create_chat", ...);
  }
}
```

**Alternatives considered**:
- Separate `registerChatReadTools()` / `registerChatWriteTools()` functions: Cleaner separation but significant refactoring, breaks the established registration pattern (Constitution VI), and doubles the number of registration calls in `startMcpServer()`.
- Filter tools after registration: Not possible — the MCP SDK doesn't support unregistering tools after they've been registered.

## R4: Environment Variable Design

**Decision**: Use `TEAMS_MCP_READ_ONLY` environment variable with truthy/falsy parsing.

**Rationale**: Environment variables are the standard MCP server configuration mechanism. The naming follows established conventions: uppercase, product-prefixed, underscore-separated.

Truthy values: `"true"`, `"1"`, `"yes"` (case-insensitive)
Falsy/absent: anything else, including `"false"`, `"0"`, `"no"`, empty string, undefined

**Alternatives considered**:
- CLI flag (`--read-only`): Rejected — MCP client configurations (Cursor, Claude, VS Code) pass environment variables via `env` blocks but don't easily support extra CLI flags.
- Config file: Rejected — over-engineered for a single boolean option; the project has no config file pattern.

## R5: Auth Status Enhancement

**Decision**: The `auth_status` tool response string will include the mode when in read-only mode. The `registerAuthTools` function receives the `readOnly` flag and uses it in the response.

**Rationale**: AI assistants use `auth_status` to understand available capabilities. Including mode information helps them avoid suggesting write operations.

Read-only response: `"✅ Authenticated as Test User (test@example.com) [Read-Only Mode]"`
Full-access response: unchanged (backward compatible)

**Alternatives considered**:
- Returning structured JSON instead of text: Rejected — would break the established response pattern (Constitution II).
- Adding a separate `get_server_mode` tool: Over-engineered for a simple status indicator.

## R6: Write Tool Classification

**Decision**: The following 4 tools are classified as "write" and excluded in read-only mode:

| Tool | Module | Write Permission Required |
|------|--------|--------------------------|
| `send_chat_message` | `chats.ts` | `Chat.ReadWrite` |
| `create_chat` | `chats.ts` | `Chat.ReadWrite` |
| `send_channel_message` | `teams.ts` | `ChannelMessage.Send` |
| `reply_to_channel_message` | `teams.ts` | `ChannelMessage.Send` |

The remaining 14 tools are all read operations and remain available in both modes.

`search_users_for_mentions` is retained in read-only mode — while mentions are typically used for composing messages, user search is a read operation and may be useful for identification purposes.

`download_message_hosted_content` is retained — it reads from Graph API and optionally writes to local disk, which is a local operation unrelated to Graph permissions.
