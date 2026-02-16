import { logger } from "@elizaos/core";
import { MessageManager } from "@elizaos/plugin-telegram";
import { Markup } from "telegraf";
import { smartChunkTelegramText } from "./chunking";
import { DraftStreamer, simulateSentenceStream } from "./draft-stream";

const TYPING_INTERVAL_MS = 4000;
const SIMULATED_STREAM_DELAY_MS = 200;
const RECEIPT_REACTIONS = ["👀", "⏳"] as const;

/** Minimal shape for a Telegram inline button. */
interface TelegramButton {
  text: string;
  url: string;
  kind?: string;
}

function toTelegramButtons(buttons: TelegramButton[] | undefined) {
  if (!Array.isArray(buttons)) return [];

  const rows: (
    | ReturnType<typeof Markup.button.url>
    | ReturnType<typeof Markup.button.login>
  )[] = [];
  for (const button of buttons) {
    if (!button || !button.text || !button.url) continue;

    if (button.kind === "login") {
      rows.push(Markup.button.login(button.text, button.url));
      continue;
    }

    rows.push(Markup.button.url(button.text, button.url));
  }

  return rows;
}

/** Minimal Telegram context shape for message handling. */
interface TelegramContext {
  chat?: { id: number };
  from?: Record<string, unknown>;
  message?: { message_id?: number };
  telegram: {
    sendMessage: (
      chatId: number,
      text: string,
      extra?: Record<string, unknown>,
    ) => Promise<object | boolean | null | undefined>;
    editMessageText?: (
      chatId: number,
      messageId: number,
      inlineMessageId: undefined,
      text: string,
      extra?: Record<string, unknown>,
    ) => Promise<object | boolean | null | undefined>;
    setMessageReaction?: (
      chatId: number,
      messageId: number,
      reactions: Array<{ type: string; emoji: string }>,
    ) => Promise<object | boolean | null | undefined>;
    sendChatAction: (
      chatId: number,
      action: string,
    ) => Promise<object | boolean | null | undefined>;
  };
}

/** Minimal content shape for message sending. */
interface MessageContent {
  text?: string;
  attachments?: unknown[];
  buttons?: TelegramButton[];
}

type BaseSendMessageContext = Parameters<
  MessageManager["sendMessageInChunks"]
>[0];
type BaseMessageContent = Parameters<MessageManager["sendMessageInChunks"]>[1];
type BaseSendMessageResult = ReturnType<MessageManager["sendMessageInChunks"]>;
type BaseHandleMessageContext = Parameters<MessageManager["handleMessage"]>[0];
type TextMessage = Awaited<BaseSendMessageResult>[number];

function toTextMessage(value: unknown): TextMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { message_id?: unknown };
  if (typeof candidate.message_id !== "number") {
    return null;
  }
  return value as TextMessage;
}

export class EnhancedTelegramMessageManager extends MessageManager {
  async sendMessageInChunks(
    ctx: BaseSendMessageContext,
    content: BaseMessageContent,
    replyToMessageId?: number,
  ): BaseSendMessageResult {
    const telegramCtx = ctx as unknown as TelegramContext;
    const telegramContent = content as unknown as MessageContent;

    if (telegramContent?.attachments?.length) {
      return super.sendMessageInChunks(ctx, content, replyToMessageId);
    }

    const finalText = telegramContent?.text ?? "";
    const chunks = smartChunkTelegramText(finalText);
    if (!telegramCtx?.chat || chunks.length === 0) {
      return [];
    }

    const telegramButtons = toTelegramButtons(telegramContent?.buttons);
    const finalReplyMarkup = telegramButtons.length
      ? Markup.inlineKeyboard(telegramButtons)
      : undefined;

    if (typeof telegramCtx.telegram.editMessageText !== "function") {
      const sentMessages: TextMessage[] = [];
      for (let i = 0; i < chunks.length; i += 1) {
        const sent = await telegramCtx.telegram.sendMessage(
          telegramCtx.chat.id,
          chunks[i].html,
          {
            parse_mode: "HTML",
            reply_parameters:
              i === 0 && replyToMessageId
                ? { message_id: replyToMessageId }
                : undefined,
            ...(i === 0 && finalReplyMarkup ? finalReplyMarkup : {}),
          },
        );
        const textMessage = toTextMessage(sent);
        if (textMessage) {
          sentMessages.push(textMessage);
        }
      }
      return sentMessages;
    }

    const streamer = new DraftStreamer({
      chatId: telegramCtx.chat.id,
      telegram: {
        sendMessage: telegramCtx.telegram.sendMessage.bind(
          telegramCtx.telegram,
        ),
        editMessageText: telegramCtx.telegram.editMessageText.bind(
          telegramCtx.telegram,
        ),
      },
      replyToMessageId,
    });

    try {
      await simulateSentenceStream(
        finalText,
        (partialText) => {
          streamer.update(partialText);
        },
        SIMULATED_STREAM_DELAY_MS,
      );

      const finalized = await streamer.finalize(finalText, {
        ...(finalReplyMarkup ?? {}),
      });
      return finalized
        .map((message) => toTextMessage(message))
        .filter((message): message is TextMessage => message !== null);
    } finally {
      streamer.stop();
    }
  }

  async handleMessage(ctx: BaseHandleMessageContext) {
    const telegramCtx = ctx as unknown as TelegramContext;

    if (!telegramCtx?.message || !telegramCtx?.from || !telegramCtx?.chat) {
      return;
    }

    const chatId = telegramCtx.chat.id;
    const reactionEmoji =
      RECEIPT_REACTIONS[Math.floor(Math.random() * RECEIPT_REACTIONS.length)];

    try {
      if (
        telegramCtx.message?.message_id &&
        typeof telegramCtx.telegram?.setMessageReaction === "function"
      ) {
        await telegramCtx.telegram.setMessageReaction(
          chatId,
          telegramCtx.message.message_id,
          [{ type: "emoji", emoji: reactionEmoji }],
        );
      }
    } catch (err) {
      logger.debug(
        `[telegram-enhanced] Reaction failed: ${err instanceof Error ? err.message : err}`,
      );
    }

    let stopped = false;
    const sendTyping = async () => {
      if (stopped) return;
      try {
        await telegramCtx.telegram.sendChatAction(chatId, "typing");
      } catch (err) {
        logger.debug(
          `[telegram-enhanced] Typing indicator failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    };

    await sendTyping();
    const interval = setInterval(() => {
      void sendTyping();
    }, TYPING_INTERVAL_MS);

    try {
      await super.handleMessage(ctx);
    } catch (error) {
      logger.error(
        { error },
        "[telegram-enhanced] Failed to handle telegram message",
      );

      const fallbackText =
        "Sorry — I hit an error while generating that response. Please try again in a moment.";

      try {
        await telegramCtx.telegram.sendMessage(chatId, fallbackText, {
          reply_parameters: telegramCtx.message?.message_id
            ? { message_id: telegramCtx.message.message_id }
            : undefined,
        });
      } catch (sendErr) {
        logger.error(
          `[telegram-enhanced] Failed to send fallback message: ${sendErr instanceof Error ? sendErr.message : sendErr}`,
        );
      }
    } finally {
      stopped = true;
      clearInterval(interval);
    }
  }
}
