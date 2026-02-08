import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { EventType } from "@elizaos/core";
import type { MessagePayload, RunEventPayload } from "@elizaos/core";
import {
  createPhettaCompanionPlugin,
  resolvePhettaCompanionOptionsFromEnv,
} from "./phetta-companion-plugin.js";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("phetta-companion-plugin", () => {
  describe("resolvePhettaCompanionOptionsFromEnv", () => {
    it("is disabled by default", () => {
      const opts = resolvePhettaCompanionOptionsFromEnv({});
      expect(opts.enabled).toBe(false);
      expect(opts.httpUrl).toBe("http://127.0.0.1:9876");
      expect(opts.timeoutMs).toBe(300);
    });

    it("parses enable + url overrides", () => {
      const opts = resolvePhettaCompanionOptionsFromEnv({
        PHETTA_COMPANION_ENABLED: "true",
        PHETTA_COMPANION_HTTP_URL: "http://127.0.0.1:9999/",
        PHETTA_COMPANION_TIMEOUT_MS: "1234",
        PHETTA_COMPANION_FORWARD_ACTIONS: "1",
      });
      expect(opts.enabled).toBe(true);
      expect(opts.httpUrl).toBe("http://127.0.0.1:9999");
      expect(opts.timeoutMs).toBe(1234);
      expect(opts.forwardActions).toBe(true);
    });
  });

  describe("event forwarding", () => {
    it("forwards MESSAGE_RECEIVED as userMessage", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const plugin = createPhettaCompanionPlugin({
        enabled: true,
        httpUrl: "http://127.0.0.1:9876",
        timeoutMs: 300,
        forwardUserMessages: true,
        forwardAssistantMessages: false,
        forwardRuns: false,
        forwardActions: false,
      });

      const handler = plugin.events?.[EventType.MESSAGE_RECEIVED]?.[0];
      expect(handler).toBeTypeOf("function");

      const payload: MessagePayload = {
        runtime: {} as any,
        message: {
          roomId: "room" as any,
          worldId: "world" as any,
          entityId: "entity" as any,
          content: { text: "hello", source: "test" },
          metadata: { sessionKey: "agent:main:self" } as any,
        } as any,
      };

      await handler!(payload as any);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, any];
      expect(url).toBe("http://127.0.0.1:9876/event");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body) as any;
      expect(body.type).toBe("userMessage");
      expect(body.message).toBe("hello");
      expect(body.data.sessionKey).toBe("agent:main:self");
    });

    it("does not forward empty text messages", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const plugin = createPhettaCompanionPlugin({
        enabled: true,
        httpUrl: "http://127.0.0.1:9876",
        timeoutMs: 300,
        forwardUserMessages: true,
        forwardAssistantMessages: true,
        forwardRuns: false,
        forwardActions: false,
      });

      const handler = plugin.events?.[EventType.MESSAGE_RECEIVED]?.[0];
      await handler!({
        runtime: {} as any,
        message: { content: { text: "   " } } as any,
      } as any);

      expect(mockFetch).toHaveBeenCalledTimes(0);
    });

    it("forwards MESSAGE_SENT as assistantMessage", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const plugin = createPhettaCompanionPlugin({
        enabled: true,
        httpUrl: "http://127.0.0.1:9876",
        timeoutMs: 300,
        forwardUserMessages: false,
        forwardAssistantMessages: true,
        forwardRuns: false,
        forwardActions: false,
      });

      const handler = plugin.events?.[EventType.MESSAGE_SENT]?.[0];
      expect(handler).toBeTypeOf("function");

      await handler!({
        runtime: {} as any,
        message: { content: { text: "hi from agent" } } as any,
      } as any);

      const body = JSON.parse((mockFetch.mock.calls[0] as any)[1].body) as any;
      expect(body.type).toBe("assistantMessage");
      expect(body.message).toBe("hi from agent");
    });

    it("forwards RUN_STARTED and RUN_ENDED as agentStart/agentDone", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const plugin = createPhettaCompanionPlugin({
        enabled: true,
        httpUrl: "http://127.0.0.1:9876",
        timeoutMs: 300,
        forwardUserMessages: false,
        forwardAssistantMessages: false,
        forwardRuns: true,
        forwardActions: false,
      });

      const started = plugin.events?.[EventType.RUN_STARTED]?.[0];
      const ended = plugin.events?.[EventType.RUN_ENDED]?.[0];
      expect(started).toBeTypeOf("function");
      expect(ended).toBeTypeOf("function");

      const runPayload: RunEventPayload = {
        runtime: {} as any,
        runId: "run" as any,
        messageId: "msg" as any,
        roomId: "room" as any,
        entityId: "entity" as any,
        startTime: Date.now(),
        status: "started",
      };

      await started!(runPayload as any);
      await ended!({ ...runPayload, status: "completed", endTime: Date.now() } as any);

      const first = JSON.parse((mockFetch.mock.calls[0] as any)[1].body) as any;
      const second = JSON.parse((mockFetch.mock.calls[1] as any)[1].body) as any;
      expect(first.type).toBe("agentStart");
      expect(second.type).toBe("agentDone");
      expect(second.data.runId).toBe("run");
    });
  });
});

