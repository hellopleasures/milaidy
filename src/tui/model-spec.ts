import { DEFAULT_PI_MODEL_SPEC, parseModelSpec } from "../utils/pi-ai.js";

export interface ResolveTuiModelSpecParams {
  modelOverride?: string;
  runtimeModelSpec?: string;
  piDefaultModelSpec?: string;
  hasCredentials: (provider: string) => boolean;
}

function toValidModelSpec(spec?: string): string | undefined {
  if (!spec) return undefined;

  const normalized = spec.trim();
  if (!normalized) return undefined;

  try {
    parseModelSpec(normalized);
    return normalized;
  } catch {
    return undefined;
  }
}

/**
 * Select the model spec used by the TUI pi-ai bridge.
 *
 * Priority:
 * 1) explicit CLI override (--model)
 * 2) runtime MODEL_PROVIDER (from config/onboarding)
 * 3) pi settings default (settings.json)
 * 4) built-in safe default
 *
 * Candidate specs are only used when credentials exist for the provider.
 */
export function resolveTuiModelSpec(params: ResolveTuiModelSpecParams): string {
  const requestedSpec =
    toValidModelSpec(params.modelOverride) ??
    toValidModelSpec(params.runtimeModelSpec);

  const defaultSpec =
    toValidModelSpec(params.piDefaultModelSpec) ?? DEFAULT_PI_MODEL_SPEC;

  if (!requestedSpec) {
    return defaultSpec;
  }

  const { provider } = parseModelSpec(requestedSpec);
  if (!params.hasCredentials(provider)) {
    return defaultSpec;
  }

  return requestedSpec;
}
