# Quickstart: Read-Only Permissions Mode

**Branch**: `001-read-only-mode` | **Date**: 2026-02-11

## What Changed

teams-mcp now supports a **read-only mode** that requires only read-level Microsoft Graph permissions. This makes it possible to use teams-mcp in organizations where IT won't grant write permissions (like `ChannelMessage.Send` or `Chat.ReadWrite`).

## How to Enable

Set the `TEAMS_MCP_READ_ONLY` environment variable to `true` before starting the server.

### In MCP Client Configuration (Cursor, Claude, VS Code)

```json
{
  "mcpServers": {
    "teams-mcp": {
      "command": "npx",
      "args": ["-y", "@floriscornel/teams-mcp@latest"],
      "env": {
        "TEAMS_MCP_READ_ONLY": "true"
      }
    }
  }
}
```

### Direct Execution

```bash
# Authenticate with read-only scopes
TEAMS_MCP_READ_ONLY=true npx @floriscornel/teams-mcp@latest authenticate

# Start server in read-only mode
TEAMS_MCP_READ_ONLY=true npx @floriscornel/teams-mcp@latest
```

## What's Available in Read-Only Mode

**Available tools** (15 tools):
- `auth_status` — Check authentication and mode
- `get_current_user`, `search_users`, `get_user` — User lookup
- `list_teams`, `list_channels`, `list_team_members` — Team browsing
- `get_channel_messages`, `get_channel_message_replies` — Read channel messages
- `search_users_for_mentions` — Find users
- `download_message_hosted_content` — Download images from messages
- `list_chats`, `get_chat_messages` — Read chats
- `search_messages`, `get_my_mentions` — Search across conversations

**Unavailable tools** (4 tools):
- `send_chat_message` — Requires `Chat.ReadWrite`
- `create_chat` — Requires `Chat.ReadWrite`
- `send_channel_message` — Requires `ChannelMessage.Send`
- `reply_to_channel_message` — Requires `ChannelMessage.Send`

## Required Permissions (Read-Only)

Request these delegated permissions from your IT department:

| Permission | Description |
|------------|-------------|
| `User.Read` | Read your own profile |
| `User.ReadBasic.All` | Read basic profiles of all users |
| `Team.ReadBasic.All` | Read team names and descriptions |
| `Channel.ReadBasic.All` | Read channel names and descriptions |
| `ChannelMessage.Read.All` | Read channel messages |
| `TeamMember.Read.All` | Read team member lists |
| `Chat.ReadBasic` | Read chat metadata |
| `Chat.Read` | Read chat messages |

## Important Notes

- If you previously authenticated in full-access mode and switch to read-only, the existing token cache still works (it has broader scopes than needed).
- If you authenticate in read-only mode and later want full access, you must re-authenticate (`npx @floriscornel/teams-mcp@latest authenticate`) without the `TEAMS_MCP_READ_ONLY` flag.
- Accepted values for `TEAMS_MCP_READ_ONLY`: `"true"`, `"1"`, `"yes"` (case-insensitive). Any other value (or unset) = full access.
