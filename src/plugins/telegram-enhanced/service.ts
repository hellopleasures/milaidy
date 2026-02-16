import { TelegramService } from "@elizaos/plugin-telegram";
import { EnhancedTelegramMessageManager } from "./message-manager";

/**
 * Minimal facade for TelegramService.
 * We keep this wrapper intentionally narrow and cast internal/private fields
 * when replacing the message manager with the enhanced implementation.
 */

// biome-ignore lint/suspicious/noExplicitAny: TelegramService internals used by this wrapper are not publicly typed
export class TelegramEnhancedService extends (TelegramService as any) {
  static serviceType =
    // biome-ignore lint/suspicious/noExplicitAny: accessing static property through compatibility cast
    (TelegramService as any).serviceType;

  static async start(runtime: unknown) {
    // biome-ignore lint/suspicious/noExplicitAny: service instance includes private/internal fields we swap at runtime
    const service = (await (TelegramService as any).start(runtime)) as Record<
      string,
      unknown
    >;
    if (service?.bot) {
      // biome-ignore lint/suspicious/noExplicitAny: EnhancedTelegramMessageManager extends untyped base class
      service.messageManager = new (EnhancedTelegramMessageManager as any)(
        service.bot,
        runtime,
      );
    }
    return service;
  }

  static async stop(runtime: unknown) {
    // biome-ignore lint/suspicious/noExplicitAny: static method access through compatibility cast
    return (TelegramService as any).stop(runtime);
  }

  constructor(runtime: unknown) {
    super(runtime);

    // biome-ignore lint/suspicious/noExplicitAny: accessing inherited untyped properties
    const self = this as any;
    if (self.bot) {
      // biome-ignore lint/suspicious/noExplicitAny: EnhancedTelegramMessageManager extends untyped base class
      self.messageManager = new (EnhancedTelegramMessageManager as any)(
        self.bot,
        runtime,
      );
    }
  }
}
