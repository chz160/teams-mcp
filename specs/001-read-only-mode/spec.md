# Feature Specification: Read-Only Permissions Mode

**Feature Branch**: `001-read-only-mode`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "teams-mcp requires a lot of microsoft graph permissions to work two of them are write permissions to chats. It is often really difficult to get IT to give you such permissions where as getting read permissions is more feasable. Change teams-mcp to have a option to only require the read permissions to work. Obviosly it will not be able to send chat messages but this is ok, not everyone wants to send messages and might only need to read for a given solution."

## User Scenarios & Testing

### User Story 1 - Run Server in Read-Only Mode (Priority: P1)

As an organization user whose IT department has only approved read-level Microsoft Graph permissions, I want to run teams-mcp in a read-only mode so that I can still read Teams messages, browse channels, search conversations, and look up users without needing write permissions that my organization won't grant.

**Why this priority**: This is the core value proposition. Many organizations have strict IT policies that make write permissions difficult or impossible to obtain. Without this capability, teams-mcp is completely unusable for these users. Enabling read-only mode unlocks the product for a significant user segment.

**Independent Test**: Can be fully tested by starting the server in read-only mode, verifying that only read tools are available, and confirming that the reduced permission set is requested during authentication. Delivers value by making teams-mcp accessible to restricted environments.

**Acceptance Scenarios**:

1. **Given** a user configures teams-mcp for read-only mode, **When** the server starts, **Then** only read-oriented tools are registered and available to the AI assistant (no send/create tools).
2. **Given** a user configures teams-mcp for read-only mode, **When** they authenticate, **Then** only read-level Microsoft Graph permissions are requested (no `ChannelMessage.Send` or `Chat.ReadWrite`).
3. **Given** a user has not configured read-only mode, **When** the server starts, **Then** all tools (both read and write) are registered as they are today (backward compatible).

---

### User Story 2 - Configure Read-Only Mode via Environment Variable (Priority: P1)

As a user setting up teams-mcp in an MCP client configuration (Cursor, Claude, VS Code), I want to enable read-only mode through an environment variable so that I can easily configure it in my MCP server JSON configuration without modifying code or passing complex CLI arguments.

**Why this priority**: Environment variables are the standard way MCP servers are configured in client tools. This is the most practical and user-friendly configuration mechanism for this feature and is essential for the core use case.

**Independent Test**: Can be tested by setting the environment variable and verifying the server starts in read-only mode. Delivers value by providing a simple, standard configuration mechanism.

**Acceptance Scenarios**:

1. **Given** the environment variable for read-only mode is set to a truthy value, **When** the server starts, **Then** it operates in read-only mode.
2. **Given** the environment variable for read-only mode is not set, **When** the server starts, **Then** it operates in full-access mode (default behavior, backward compatible).
3. **Given** the environment variable is set to a falsy value (e.g., "false", "0"), **When** the server starts, **Then** it operates in full-access mode.

---

### User Story 3 - Clear Feedback on Active Mode (Priority: P2)

As a user running teams-mcp, I want clear feedback about which mode the server is operating in so that I understand what capabilities are available and am not confused when write tools are absent.

**Why this priority**: Without clear communication of the active mode, users (and AI assistants) may be confused about missing tools or attempt actions that aren't available, leading to a poor experience.

**Independent Test**: Can be tested by starting the server in each mode and verifying that startup logs and the auth status tool clearly indicate the active mode. Delivers value by preventing user confusion.

**Acceptance Scenarios**:

1. **Given** the server starts in read-only mode, **When** the startup log is emitted, **Then** the log clearly states the server is running in read-only mode.
2. **Given** the server is running in read-only mode, **When** a user checks authentication status, **Then** the response indicates read-only mode is active.
3. **Given** the server starts in full-access mode (default), **When** the startup log is emitted, **Then** no special mode indicator is needed (standard behavior).

---

### Edge Cases

- What happens when a user authenticates in full-access mode but later switches to read-only mode? The server should use the read-only permission set; the cached token may have broader scopes but only read operations will be exposed.
- What happens when a user authenticates in read-only mode but later switches to full-access mode? A re-authentication will be required since the cached token won't have the write scopes.
- What happens if an AI assistant attempts to call a write tool that doesn't exist in read-only mode? The MCP protocol handles this naturally — unregistered tools simply don't appear in the tool list, so the assistant won't attempt to use them.

## Requirements

### Functional Requirements

- **FR-001**: System MUST support a read-only operating mode that can be activated via an environment variable (`TEAMS_MCP_READ_ONLY`).
- **FR-002**: In read-only mode, the system MUST NOT register write-oriented tools: `send_chat_message`, `create_chat`, `send_channel_message`, and `reply_to_channel_message`.
- **FR-003**: In read-only mode, the system MUST request only read-level Microsoft Graph permissions, excluding `ChannelMessage.Send` and replacing `Chat.ReadWrite` with `Chat.Read`.
- **FR-004**: In full-access mode (default), the system MUST behave identically to the current implementation with all tools and permissions available.
- **FR-005**: The system MUST log the active mode (read-only or full-access) during server startup so operators can confirm the configuration.
- **FR-006**: The `auth_status` tool MUST include the active mode in its response so AI assistants understand what capabilities are available.
- **FR-007**: The system MUST support read-only mode configuration in MCP client JSON configurations by accepting the environment variable in the `env` block.
- **FR-008**: In read-only mode, all read-oriented tools MUST continue to function normally: `list_chats`, `get_chat_messages`, `list_teams`, `list_channels`, `get_channel_messages`, `get_channel_message_replies`, `list_team_members`, `search_users_for_mentions`, `download_message_hosted_content`, `search_messages`, `get_my_mentions`, `auth_status`, `get_current_user`, `search_users`, and `get_user`.

### Key Entities

- **Operating Mode**: The server's permission level — either "read-only" (reduced permissions, read tools only) or "full-access" (all permissions, all tools). Determined at startup from environment configuration.
- **Tool Category**: Classification of each MCP tool as either "read" (available in all modes) or "write" (available only in full-access mode).
- **Permission Set**: The collection of Microsoft Graph scopes requested during authentication, which varies based on the active operating mode.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can start the server in read-only mode and successfully browse Teams, channels, and messages using only read-level permissions.
- **SC-002**: Switching between modes requires only a single environment variable change with no code modifications.
- **SC-003**: Existing users experience zero behavior changes when the read-only mode is not enabled (full backward compatibility).
- **SC-004**: The active operating mode is clearly communicated in both startup logs and auth status responses.
- **SC-005**: All existing tests continue to pass without modification when running in the default full-access mode.

### Assumptions

- The environment variable `TEAMS_MCP_READ_ONLY` is the appropriate naming convention, consistent with common environment variable patterns (uppercase, underscored, prefixed with product name).
- `Chat.Read` is the appropriate read-only replacement for `Chat.ReadWrite` in the Microsoft Graph permission model. This scope allows reading chat metadata and messages without write access.
- The `search_messages` and `get_my_mentions` tools use the Search API with a POST request, but this is a query operation (not a data mutation) and is considered a read operation. These tools require `Mail.Read`, `Calendars.Read`, `Files.Read.All`, and `Sites.Read.All` scopes which are all read-level permissions.
- Users who need to switch from read-only to full-access mode understand they will need to re-authenticate to acquire write-level permission scopes.
- The `download_message_hosted_content` tool writes files to the local filesystem (via `savePath` parameter), but this is considered a local operation, not a Microsoft Graph write operation, and should remain available in read-only mode.
