// Stub for @elizaos/plugin-coding-agent used in e2e tests.
// The real module is optional and not available in all environments.
export function createCodingAgentRouteHandler() {
  return async () => undefined;
}

export function getCoordinator() {
  return undefined;
}

export interface SwarmEvent {
  type: string;
  [key: string]: unknown;
}

export interface PTYService {
  coordinator: null;
}

export interface CoordinationLLMResponse {
  action: "respond" | "escalate" | "ignore" | "complete";
  response?: string;
  useKeys?: boolean;
  keys?: string[];
  reasoning: string;
}

export interface TaskContext {
  sessionId: string;
  agentType: string;
  label: string;
  originalTask: string;
  workdir: string;
  repo?: string;
  status: "active" | "completed" | "error" | "stopped";
  decisions: unknown[];
  autoResolvedCount: number;
  registeredAt: number;
  lastActivityAt: number;
  idleCheckCount: number;
}
