# Data Model: Read-Only Permissions Mode

**Branch**: `001-read-only-mode` | **Date**: 2026-02-11

## Entities

### Operating Mode

This feature does not introduce persistent data entities. The operating mode is a runtime configuration value derived from the environment.

| Property | Type | Source | Description |
|----------|------|--------|-------------|
| `readOnly` | `boolean` | `process.env.TEAMS_MCP_READ_ONLY` | `true` when the server operates in read-only mode |

**Derivation logic**:
```
readOnly = ["true", "1", "yes"].includes(
  process.env.TEAMS_MCP_READ_ONLY?.toLowerCase()?.trim()
)
```

### Permission Sets

Two static scope arrays, selected based on `readOnly`:

**Full-access scopes** (default, existing behavior):
```
User.Read, User.ReadBasic.All, Team.ReadBasic.All, Channel.ReadBasic.All,
ChannelMessage.Read.All, ChannelMessage.Send, TeamMember.Read.All,
Chat.ReadBasic, Chat.ReadWrite
```

**Read-only scopes**:
```
User.Read, User.ReadBasic.All, Team.ReadBasic.All, Channel.ReadBasic.All,
ChannelMessage.Read.All, TeamMember.Read.All, Chat.ReadBasic, Chat.Read
```

**Differences**:

| Scope | Full-Access | Read-Only | Reason |
|-------|------------|-----------|--------|
| `ChannelMessage.Send` | Included | Excluded | Only needed for sending channel messages/replies |
| `Chat.ReadWrite` | Included | Excluded | Only needed for sending chat messages and creating chats |
| `Chat.Read` | Not needed | Included | Replaces `Chat.ReadWrite` for reading chat messages |

### Tool Classification

| Tool Name | Module | Category | Available in Read-Only |
|-----------|--------|----------|----------------------|
| `auth_status` | auth.ts | read | Yes |
| `get_current_user` | users.ts | read | Yes |
| `search_users` | users.ts | read | Yes |
| `get_user` | users.ts | read | Yes |
| `list_teams` | teams.ts | read | Yes |
| `list_channels` | teams.ts | read | Yes |
| `get_channel_messages` | teams.ts | read | Yes |
| `get_channel_message_replies` | teams.ts | read | Yes |
| `list_team_members` | teams.ts | read | Yes |
| `search_users_for_mentions` | teams.ts | read | Yes |
| `download_message_hosted_content` | teams.ts | read | Yes |
| `list_chats` | chats.ts | read | Yes |
| `get_chat_messages` | chats.ts | read | Yes |
| `search_messages` | search.ts | read | Yes |
| `get_my_mentions` | search.ts | read | Yes |
| `send_chat_message` | chats.ts | write | No |
| `create_chat` | chats.ts | write | No |
| `send_channel_message` | teams.ts | write | No |
| `reply_to_channel_message` | teams.ts | write | No |

## State Transitions

No state machines. The mode is immutable for the lifetime of the server process — set at startup, never changed.

## Relationships

```
Environment Variable (TEAMS_MCP_READ_ONLY)
  └─→ Operating Mode (readOnly boolean)
        ├─→ Permission Set (scopes for authentication)
        │     ├─→ authenticate() in index.ts
        │     └─→ acquireTokenSilent() in graph.ts
        ├─→ Tool Registration (conditional in startMcpServer)
        │     ├─→ registerChatTools(server, graphService, readOnly)
        │     └─→ registerTeamsTools(server, graphService, readOnly)
        └─→ Status Reporting
              ├─→ Startup log message
              └─→ auth_status tool response
```
