# Plugin Coding Agent Integration Playbook

This document provides a step-by-step guide for verifying that the `@milaidy/plugin-coding-agent` integration is fully functional.

## Overview

The plugin integrates two external packages:
- **pty-manager** - Manages PTY sessions for running CLI coding agents
- **git-workspace-service** - Manages git workspaces for isolated development

## Prerequisites

1. Node.js >= 22
2. pnpm package manager
3. The peer dependencies installed:
   - `@elizaos/core` >= 2.0.0-alpha.0
   - `pty-manager` >= 1.0.0
   - `git-workspace-service` >= 0.3.0

## Step 1: Run Automated Tests

First, verify all 122 tests pass:

```bash
cd packages/plugin-coding-agent
npm test
```

Expected output:
```
 ✓ src/__tests__/provision-workspace.test.ts (13 tests)
 ✓ src/__tests__/stop-agent.test.ts (14 tests)
 ✓ src/__tests__/send-to-agent.test.ts (14 tests)
 ✓ src/__tests__/finalize-workspace.test.ts (17 tests)
 ✓ src/__tests__/spawn-agent.test.ts (17 tests)
 ✓ src/__tests__/workspace-service.test.ts (19 tests)
 ✓ src/__tests__/list-agents.test.ts (10 tests)
 ✓ src/__tests__/pty-service.test.ts (18 tests)

 Test Files  8 passed (8)
      Tests  122 passed (122)
```

## Step 2: TypeScript Compilation

Verify TypeScript compiles without errors:

```bash
npm run typecheck
```

Should exit with code 0 (no output means success).

## Step 3: Plugin Registration

To use the plugin in a Milaidy agent, register it in your agent configuration:

```typescript
import { codingAgentPlugin } from "@milaidy/plugin-coding-agent";

const agent = new AgentRuntime({
  plugins: [codingAgentPlugin],
  // ... other config
});
```

## Step 4: Manual Integration Testing

### 4.1 PTY Service Tests

The PTY service manages coding agent sessions. Key actions:

| Action | Description |
|--------|-------------|
| `SPAWN_CODING_AGENT` | Start a new coding agent session |
| `SEND_TO_CODING_AGENT` | Send input or keys to an active session |
| `LIST_CODING_AGENTS` | List all active sessions |
| `STOP_CODING_AGENT` | Stop a session |

Example spawn configuration:
```json
{
  "agentType": "claude-code",
  "workdir": "/path/to/project",
  "task": "Fix the authentication bug"
}
```

Supported agent types:
- `claude-code` (default)
- `claude` (alias for claude-code)
- `codex` (maps to shell adapter)
- `gemini-cli`
- `aider`
- `shell` (generic shell)

### 4.2 Workspace Service Tests

The workspace service manages git repositories. Key actions:

| Action | Description |
|--------|-------------|
| `PROVISION_WORKSPACE` | Clone a repo or create a worktree |
| `FINALIZE_WORKSPACE` | Commit, push, and create PR |

Example provision configuration:
```json
{
  "repo": "https://github.com/user/repo.git",
  "baseBranch": "main",
  "useWorktree": false
}
```

Example finalize configuration:
```json
{
  "workspaceId": "ws-123",
  "commitMessage": "feat: add new feature",
  "prTitle": "Add new feature",
  "prBody": "This PR adds the new feature",
  "draft": false
}
```

## Step 5: Verify Service Registration

The plugin exports two services that should be registered with the ElizaOS runtime:

- `PTY_SERVICE` - PTYService instance
- `CODING_WORKSPACE_SERVICE` - CodingWorkspaceService instance

Verify services are accessible:
```typescript
const ptyService = runtime.getService("PTY_SERVICE");
const workspaceService = runtime.getService("CODING_WORKSPACE_SERVICE");

console.assert(ptyService != null, "PTY service should be registered");
console.assert(workspaceService != null, "Workspace service should be registered");
```

## Step 6: Action Validation

Each action has a `validate` method that checks if the required services are available. Test validation:

```typescript
// PTY actions require PTY_SERVICE
const canSpawn = await spawnAgentAction.validate(runtime, message);

// Workspace actions require CODING_WORKSPACE_SERVICE
const canProvision = await provisionWorkspaceAction.validate(runtime, message);
```

## Test Coverage Summary

| Test File | Tests | Coverage |
|-----------|-------|----------|
| pty-service.test.ts | 18 | Service initialization, session management |
| workspace-service.test.ts | 19 | Workspace provisioning, git operations |
| spawn-agent.test.ts | 17 | Agent spawning, type mapping |
| send-to-agent.test.ts | 14 | Input/key sending, session lookup |
| stop-agent.test.ts | 14 | Session stopping, batch operations |
| list-agents.test.ts | 10 | Session listing, formatting |
| provision-workspace.test.ts | 13 | Repo cloning, worktree creation |
| finalize-workspace.test.ts | 17 | Commit, push, PR creation |

## Known Limitations

1. **Custom workspace names**: The `name` parameter for `PROVISION_WORKSPACE` is not yet implemented
2. **Callback data properties**: Callbacks only include `text` messages, not structured `data` objects

## Troubleshooting

### PTYService not available
- Ensure `pty-manager` package is installed
- Check that the plugin is registered with the runtime

### WorkspaceService not available
- Ensure `git-workspace-service` package is installed
- Check that the plugin is registered with the runtime

### Session spawn failures
- Verify the agent type is supported
- Check that the workdir exists and is accessible
- Ensure the underlying CLI tool (claude, codex, etc.) is installed

## Success Criteria

The integration is considered successful when:
- [ ] All 122 tests pass
- [ ] TypeScript compiles without errors
- [ ] Services can be registered with the runtime
- [ ] Actions can be invoked and return expected results
- [ ] Error handling works correctly for edge cases
