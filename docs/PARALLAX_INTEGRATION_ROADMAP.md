# Parallax Integration Roadmap

> **Status:** Planning
> **Author:** Jakob Grant
> **Created:** 2026-02-15
> **Target:** 2-week sprint proof-of-concept

---

## Executive Summary

This document outlines a potential integration between **Milaidy** (ElizaOS-based personal AI assistant) and **Parallax** (multi-agent orchestration platform) to fill gaps in Milaidy's coding agent system.

### Why Parallax?

| Milaidy Gap | Parallax Solution |
|-------------|-------------------|
| Coding agent loop types exist, no executor | Pattern engine + runtime pooling |
| Basic shell execution | PTY Manager with OAuth/prompt handling |
| No confidence tracking | First-class confidence scores (0.0-1.0) |
| Single-agent iterations | Multi-agent patterns (consensus, voting, delegation) |
| No quality gates | Threshold-based validation patterns |

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Parallax not battle-tested | Medium | Start with PTY Manager only (most mature) |
| Prism DSL is new | Medium | Use YAML patterns, skip Prism initially |
| LLMs don't give confidence | Medium | Map Milaidy trust signals to confidence |
| 2-week timeline | High | Focus on single integration point |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Milaidy                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ ElizaOS      │  │ Connectors   │  │ UI (React/Capacitor) │   │
│  │ Runtime      │  │ (TG/Discord) │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           milaidy-parallax-bridge (NEW)                   │   │
│  │  - PTY Bridge (replaces @elizaos/plugin-shell)           │   │
│  │  - Confidence Mapper (trust levels → 0.0-1.0)            │   │
│  │  - Pattern Client (executes Parallax patterns)           │   │
│  │  - Coding Loop Executor (the missing piece!)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Parallax Control Plane                         │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │ Pattern Engine │  │ YAML→Prism      │  │ Confidence      │   │
│  │                │  │ Compiler        │  │ Tracker         │   │
│  └────────────────┘  └─────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Parallax Runtime (Local)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PTY Manager                            │   │
│  │  - Multi-session management                               │   │
│  │  - Shell/Docker/SSH adapters                              │   │
│  │  - OAuth prompt detection                                 │   │
│  │  - Terminal streaming (xterm.js)                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Confidence Mapping Strategy

Milaidy has existing trust/quality signals that can map to Parallax confidence:

### Trust Level Mapping

```typescript
const TRUST_TO_CONFIDENCE: Record<TrustLevel, number> = {
  owner_trusted: 0.95,
  high: 0.85,
  medium: 0.70,
  low: 0.50,
  untrusted: 0.30,
};
```

### Iteration-Based Confidence

```typescript
function computeIterationConfidence(iteration: CodingIteration): number {
  let confidence = 1.0;

  // Degrade based on errors
  const compileErrors = iteration.errors.filter(e => e.category === 'compile').length;
  const testErrors = iteration.errors.filter(e => e.category === 'test').length;
  const lintErrors = iteration.errors.filter(e => e.category === 'lint').length;

  confidence -= compileErrors * 0.20;  // Compile errors are severe
  confidence -= testErrors * 0.15;     // Test failures
  confidence -= lintErrors * 0.05;     // Lint is minor

  // Factor in command success rate
  const cmdSuccess = iteration.commandResults.filter(c => c.success).length;
  const cmdTotal = iteration.commandResults.length;
  if (cmdTotal > 0) {
    confidence *= (cmdSuccess / cmdTotal);
  }

  return Math.max(0.1, Math.min(1.0, confidence));
}
```

---

## Week 1: Foundation (Days 1-5)

### Day 1-2: PTY Manager Integration

**Goal:** Replace `@elizaos/plugin-shell` with Parallax PTY Manager

**Files to Create:**
```
packages/milaidy-parallax-bridge/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── pty-bridge.ts
    └── types.ts
```

**Key Implementation:**
```typescript
// src/pty-bridge.ts
import { PTYManager, ShellAdapter } from '@parallax/pty-manager';
import type { CodingAgentContext, CommandResult } from 'milaidy';

export class MilaidyPTYBridge {
  private manager = new PTYManager();
  private sessions = new Map<string, string>();

  constructor() {
    this.manager.registerAdapter(new ShellAdapter());
  }

  async executeForContext(
    ctx: CodingAgentContext,
    command: string
  ): Promise<CommandResult> {
    let ptyId = this.sessions.get(ctx.sessionId);

    if (!ptyId) {
      const handle = await this.manager.spawn({
        name: `milaidy-${ctx.sessionId}`,
        type: 'shell',
        workdir: ctx.workingDirectory,
      });
      ptyId = handle.id;
      this.sessions.set(ctx.sessionId, ptyId);
    }

    return this.captureCommand(ptyId, command);
  }
}
```

**Success Criteria:**
- [ ] PTY sessions spawn from Milaidy context
- [ ] Commands execute with output capture
- [ ] Errors parsed into CapturedError[]
- [ ] Sessions persist across iterations

### Day 3-4: Confidence Mapper + Pattern Test

**Goal:** Map signals to confidence, execute first pattern

**Files to Add:**
```
packages/milaidy-parallax-bridge/src/
├── confidence-mapper.ts
└── pattern-client.ts
```

**Test Pattern (YAML, not Prism):**
```yaml
# patterns/milaidy-code-check.yaml
name: "milaidy-code-check"
version: "1.0.0"
description: "Basic code quality check"

structure:
  roles:
    analyzer:
      capabilities: ["code-analysis"]
      minInstances: 1

workflow:
  steps:
    - type: "assign"
      role: "analyzer"
      task: "Check code quality"
```

**Success Criteria:**
- [ ] Confidence computed from iteration state
- [ ] Parallax control plane starts locally
- [ ] Pattern executes and returns confidence
- [ ] WebSocket streams execution events

### Day 5: Integration Test + Demo

**Goal:** End-to-end: Milaidy → PTY → Pattern → Result

**Demo Script:**
```typescript
async function demo() {
  const ctx = createCodingAgentContext({
    sessionId: 'demo-1',
    taskDescription: 'Fix TypeScript errors',
    workingDirectory: '/tmp/test-project',
    connectorType: 'local-fs',
    connectorBasePath: '/tmp/test-project',
  });

  const bridge = new MilaidyPTYBridge();
  const result = await bridge.executeForContext(ctx, 'tsc --noEmit');
  const confidence = computeConfidence(result);

  console.log(`Confidence: ${confidence}`);

  if (confidence < 0.7) {
    const client = new ParallaxClient({ baseUrl: 'http://localhost:8080' });
    const analysis = await client.executePattern('code-review', {
      errors: result.errors,
    });
    console.log('Multi-agent analysis:', analysis);
  }
}
```

---

## Week 2: Orchestration (Days 6-10)

### Day 6-7: Coding Agent Loop

**Goal:** Implement the actual loop using `cascading-refinement.prism`

```typescript
// src/coding-loop.ts
async function runCodingLoop(ctx: CodingAgentContext): Promise<CodingAgentContext> {
  const client = new ParallaxClient({ baseUrl: 'http://localhost:8080' });

  while (shouldContinueLoop(ctx).shouldContinue) {
    const result = await client.executePattern('cascading-refinement', {
      task: ctx.taskDescription,
      workspace: ctx.workingDirectory,
      previousErrors: getUnresolvedErrors(ctx),
    });

    const iteration: CodingIteration = {
      index: ctx.iterations.length,
      startedAt: Date.now(),
      completedAt: Date.now(),
      errors: result.errors || [],
      commandResults: result.commands || [],
      selfCorrected: result.confidence > 0.8,
    };

    ctx = addIteration(ctx, iteration);
  }

  return ctx;
}
```

### Day 8-9: Multi-Agent Code Review

**Goal:** Use `code-review.prism` for validation

```typescript
if (iteration.errors.length > 0) {
  const review = await client.executePattern('code-review', {
    code: generatedCode,
    errors: iteration.errors,
  });

  switch (review.recommendation) {
    case 'approve': break;
    case 'request_changes':
      ctx = injectFeedback(ctx, {
        id: `review-${Date.now()}`,
        timestamp: Date.now(),
        text: review.summary,
        type: 'correction',
      });
      break;
    case 'block':
      ctx.active = false;
      break;
  }
}
```

### Day 10: Polish + Documentation

- [ ] Error handling
- [ ] Logging
- [ ] README
- [ ] Demo video
- [ ] Known limitations
- [ ] Post-sprint roadmap

---

## Relevant Parallax Patterns

### Tier 1: Essential

| Pattern | File | Use Case |
|---------|------|----------|
| Cascading Refinement | `cascading-refinement.prism` | Fast → Balanced → Thorough analysis |
| Code Review | `code-review.prism` | Multi-agent validation |
| Enterprise Review | `org-enterprise-review.yaml` | Engineer → Tech Lead → Architect |

### Tier 2: Supporting

| Pattern | File | Use Case |
|---------|------|----------|
| Uncertainty Router | `uncertainty-router.prism` | Route by confidence level |
| Confidence Cascade | `confidence-cascade.prism` | Early-exit optimization |
| Quality Gate | `quality-gate.prism` | RAG-style validation |

### Tier 3: Advanced

| Pattern | File | Use Case |
|---------|------|----------|
| Epistemic Orchestrator | `epistemic-orchestrator.prism` | Capture valuable disagreements |
| Parallel Exploration | `parallel-exploration.prism` | Multiple implementation options |

---

## Fallback Plan

If time runs short:

### Must Have (Week 1)
1. PTY Manager working
2. Basic confidence mapping

### Nice to Have (Week 2)
3. Single pattern execution
4. Coding loop

### Post-Sprint
5. Multi-agent code review
6. Org-chart patterns
7. Full Prism DSL

---

## Dependencies

```json
{
  "@parallax/pty-manager": "workspace:*",
  "@parallax/sdk-typescript": "workspace:*"
}
```

---

## Open Questions

1. **Team alignment:** Is coding agent the priority, or voice/task balance?
2. **Infrastructure:** Can control plane run alongside Milaidy?
3. **Testing:** What's the test environment?
4. **Demo:** What would impress the team?

---

## References

- Milaidy coding agent types: `src/services/coding-agent-context.ts`
- Parallax control plane: `/Workspaces/parallax/packages/control-plane`
- Parallax patterns: `/Workspaces/parallax/patterns/`
- Parallax docs: `https://docs.parallaxai.dev`
