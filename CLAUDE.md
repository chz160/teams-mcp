# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**teams-mcp** is a Model Context Protocol (MCP) server that bridges AI assistants to Microsoft Teams via Microsoft Graph APIs. It runs as a CLI tool over stdio transport, enabling AI assistants like Claude, Cursor, and VS Code Copilot to read/send Teams messages, manage chats, search conversations, and interact with users.

Published as `@floriscornel/teams-mcp` on npm.

## Development Commands

### Build & Run
```bash
npm run build          # Clean dist/ + compile TypeScript
npm run compile        # TypeScript compilation only
npm run dev            # Watch mode with tsx
npm run clean          # Remove dist/ directory
```

### Testing
```bash
npm test               # Run all tests
npm run test:watch     # Interactive watch mode
npm run test:coverage  # Generate coverage report (80% threshold required)
npm run test:ui        # Vitest UI mode
```

### Linting & Formatting
```bash
npm run lint           # Biome check (linting only)
npm run lint:fix       # Biome check with auto-fix (write + unsafe)
npm run format         # Biome format with write
npm run ci             # CI mode (fails on warnings)
```

### Authentication (Post-Build)
```bash
npm run auth           # Authenticate with Microsoft Graph
npm run auth:check     # Check authentication status
npm run auth:logout    # Clear stored credentials
```

### Running Individual Tests
```bash
npx vitest run src/tools/__tests__/chats.test.ts           # Single file
npx vitest run -t "send_chat_message"                      # By test name pattern
npx vitest run src/tools/__tests__/ --coverage             # Specific directory with coverage
```

## Architecture

### Core Components

**Dual-mode entry point** (`src/index.ts`):
- CLI mode: `authenticate`, `check`, `logout` commands
- MCP server mode (default): Registers tools and connects via stdio transport

**Data flow:**
```
AI Assistant → stdio → McpServer → register*Tools handler → GraphService.getClient() → Microsoft Graph API
```

**Key modules:**
- `src/index.ts` — Entry point; dual-mode CLI/MCP server; registers all tool modules
- `src/services/graph.ts` — `GraphService` singleton; manages Microsoft Graph client initialization with cached OAuth tokens (`~/.teams-mcp-token-cache.json`)
- `src/msal-cache.ts` — Token cache persistence plugin for MSAL
- `src/tools/*.ts` — Tool registration modules (auth, chats, search, teams, users); each exports `register*Tools(server, graphService)`
- `src/types/graph.ts` — TypeScript type definitions; re-exports from `@microsoft/microsoft-graph-types` plus custom `*Summary` types
- `src/utils/` — Shared utilities:
  - `markdown.ts` — Markdown→sanitized HTML (marked + DOMPurify)
  - `attachments.ts` — Image upload as Microsoft Graph hosted content
  - `users.ts` — @mention parsing and user lookup

### Authentication Strategy

Dual-token approach:
1. **MSAL OAuth 2.0** (default): Device code flow with refresh token caching at `~/.teams-mcp-token-cache.json`
2. **Direct token injection**: Via `AUTH_TOKEN` environment variable (for testing/CI)

Token persistence ensures automatic renewal without re-authentication every hour.

### Tool Registration Pattern

Every tool module follows this structure:

```typescript
export function registerXxxTools(server: McpServer, graphService: GraphService) {
  server.tool(
    "tool_name",           // snake_case tool name
    "Description string",  // user-facing description
    { /* Zod schema */ },  // input validation with .describe() for params
    async (args) => {
      const client = await graphService.getClient();
      // ... Graph API call ...
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

When adding new tools:
1. Create the tool module in `src/tools/`
2. Export a `register*Tools()` function
3. Register it in `src/index.ts` inside `startMcpServer()`
4. Add tests in `src/tools/__tests__/`

### API Response Conventions

- **Success**: Return `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`
- **Errors**: Catch, extract message via `error instanceof Error ? error.message : "Unknown error occurred"`, return `❌ Error: ${errorMessage}`
- **Optional properties**: All Graph response types use `| undefined` to handle API variability (see `*Summary` interfaces in `src/types/graph.ts`)
- **Format parameter**: Message sending tools support `format: "text" | "markdown"`. When `"markdown"`, content is converted via `markdownToHtml()` and sent as `contentType: "html"`

## TypeScript & Module Conventions

**ESM-only project** (`"type": "module"` in package.json):
- Use `.js` extensions in import paths despite `.ts` source files
- TypeScript `moduleResolution: "bundler"` enables this
- Example: `import { GraphService } from "../services/graph.js";`

**Strict mode enabled:**
- `noUnusedLocals`, `noUnusedParameters` — Clean up unused vars
- `exactOptionalPropertyTypes` — Strict optional handling
- `noImplicitOverride` — Explicit override keywords
- Prefix unused catch variables with underscore: `catch (_error)`

**Import conventions:**
- Use `node:` protocol for Node.js built-ins: `import { promises as fs } from "node:fs";`
- No default imports unless explicitly available (use named imports)

**Linting/formatting:**
- **Biome** (not ESLint/Prettier) — Single tool for both
- Config in `biome.json`

## Testing Architecture

### Framework & Tools

- **Vitest** with global test APIs (`describe`, `it`, `expect` — no imports needed)
- **MSW (Mock Service Worker)** for HTTP mocking of `graph.microsoft.com` endpoints
- **Coverage**: v8 provider with 80% threshold on branches, functions, lines, statements

### Test Structure

**Global setup** (`src/test-utils/vitest.setup.ts`):
- Starts/resets/stops MSW server
- Shared mock handlers and fixtures in `src/test-utils/setup.ts`

**Tool test pattern** (canonical example in `src/tools/__tests__/chats.test.ts`):
```typescript
const mockServer = {
  tool: vi.fn(),
  resource: vi.fn(),
  prompt: vi.fn(),
};
const mockGraphService = {
  getClient: vi.fn().mockResolvedValue(mockClient),
};

registerChatTools(mockServer as unknown as McpServer, mockGraphService);

// Extract registered handler from mock calls
const call = vi.mocked(mockServer.tool).mock.calls.find(([name]) => name === "tool_name");
const handler = call?.[3] as (args: any) => Promise<any>;

// Invoke directly
const result = await handler({ chatId: "abc123", message: "Hello" });
```

**MSW handlers** for Graph API mocking:
- Intercept HTTP requests to `graph.microsoft.com`
- Return mock responses with realistic data shapes
- Use `http.get()`, `http.post()`, etc. from `msw` package

### Coverage Exclusions

Excluded from coverage (see `vitest.config.ts`):
- `index.ts` (entry point)
- `test-utils/**` (test infrastructure)
- `**/*.test.ts`, `**/*.spec.ts` (test files)
- Config files, type declarations

## Rich Message Formatting

**Markdown support** in these tools:
- `send_channel_message`
- `send_chat_message`
- `reply_to_channel_message`

**Security implementation:**
1. Parse markdown with `marked` library
2. Sanitize HTML output with `DOMPurify` (defense in depth)
3. Allow only safe tags (p, strong, em, a, ul, ol, li, h1-h6, code, pre, etc.)
4. Allow only safe attributes (href, target, src, alt, title, width, height)
5. XSS prevention through automatic sanitization

**@Mention processing** (`src/utils/users.ts`):
1. User provides mention mappings: `[{ mention: "john.doe", userId: "abc123" }]`
2. Look up display names via Graph API
3. Replace @mentions in HTML: `@john.doe` → `<at id="0">John Doe</at>`
4. Return structured mentions array for Teams API

**Image attachments** (`src/utils/attachments.ts`):
1. Convert image URL/data to base64
2. POST to `/hostedContents` endpoint → get `hostedContentId`
3. Create attachment reference with `contentUrl`
4. Include in message payload

## Microsoft Graph Permissions

Required delegated scopes (configured in `src/index.ts`):
```
User.Read, User.ReadBasic.All
Team.ReadBasic.All, Channel.ReadBasic.All
ChannelMessage.Read.All, ChannelMessage.Send
TeamMember.Read.All
Chat.ReadBasic, Chat.ReadWrite
Mail.Read, Calendars.Read, Files.Read.All, Sites.Read.All (for Search API)
```

## Search Functionality

**KQL (Keyword Query Language) support** in `search_messages` tool:
- Filters: `from:`, `to:`, `mentions:`, `hasAttachment:`, `sent>=`, `sent<=`, `importance:`, etc.
- Pagination with `from`/`size` parameters
- Relevance ranking with `enableTopResults`

**Recent refactoring (v0.5.0):**
- Added `formatSearchHits()` for standardized search result formatting
- Removed redundant `get_recent_messages` tool (use search instead)
- Streamlined `get_my_mentions` tool

## Pagination Strategies

**Chat messages** (`get_chat_messages`):
- Manual pagination with `fetchAll` parameter
- Follow `@odata.nextLink` until reaching limit or max pages
- Client-side filtering when Graph API lacks server-side support (e.g., date ranges)

**Channel messages** (`get_channel_messages`):
- Similar pagination strategy
- Hard-coded max pages: 100 (configurable if needed)

## CI/CD Pipeline

**GitHub Actions** (`.github/workflows/`):
- **Test matrix**: Node v20, v22, v24
- **Steps**: Install → Lint → Typecheck → Test with coverage → Build → CLI smoke test
- **Coverage upload**: Codecov with test analytics
- **Release workflow**: Tag-triggered (`release.yml`); uses npm trusted publishers (OpenID Connect)

**Pre-publish:**
- `prepublishOnly` script runs `npm run build` automatically

## Local Development Workflow

1. **Initial setup:**
   ```bash
   npm install
   npm run build
   npm run auth  # Authenticate with Microsoft Graph
   ```

2. **Development cycle:**
   ```bash
   npm run dev               # Start watch mode
   npm run test:watch        # Run tests in watch mode
   ```

3. **Before commit:**
   ```bash
   npm run lint:fix          # Auto-fix linting issues
   npm run test:coverage     # Ensure 80%+ coverage
   npm run build             # Verify build succeeds
   ```

4. **Testing MCP integration:**
   Add to Cursor/Claude config:
   ```json
   {
     "mcpServers": {
       "teams-mcp": {
         "command": "node",
         "args": ["E:\\GitHub\\teams-mcp\\dist\\index.js"]
       }
     }
   }
   ```

## Common Pitfalls

1. **ESM imports:** Always use `.js` extensions even for `.ts` files
2. **Unused variables:** Prefix with underscore (`_error`) to satisfy `noUnusedLocals`
3. **Optional properties:** Graph API responses are inconsistent; always use `| undefined` in types
4. **Token cache path:** Two files exist:
   - `~/.teams-mcp-token-cache.json` (MSAL refresh tokens)
   - `~/.msgraph-mcp-auth.json` (auth info for CLI status checks)
5. **Coverage threshold:** 80% minimum on all metrics; `index.ts` and `test-utils/` excluded
6. **MSW setup:** Tests fail if MSW server not properly started in setup file
