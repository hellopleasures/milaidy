/**
 * CANCEL_POLYMARKET_ORDER — cancels a resting limit order before it fills.
 *
 * Uses the existing PolymarketService's authenticated CLOB client.
 */
import type { Action, HandlerOptions } from "@elizaos/core";
import {
  canTrade,
  getServiceOrThrow,
  invalidateCache,
  type OpenOrderLike,
} from "./service-helper.js";

export const cancelOrderAction: Action = {
  name: "CANCEL_POLYMARKET_ORDER",
  similes: [
    "POLYMARKET_CANCEL_ORDER",
    "POLYMARKET_CANCEL_BET",
    "POLYMARKET_REMOVE_ORDER",
    "POLYMARKET_CANCEL_TRADE",
    "POLYMARKET_CANCEL_ALL_ORDERS",
  ],
  description:
    "Cancel an open order on Polymarket CLOB. Provide orderId to cancel a specific order, or set cancelAll=true to cancel all open orders. Omit both to list cancelable orders.",
  validate: async (runtime) => canTrade(runtime),
  handler: async (runtime, _message, _state, options) => {
    try {
      const params = (options as HandlerOptions | undefined)?.parameters;
      const orderId =
        typeof params?.orderId === "string" ? params.orderId.trim() : undefined;
      const cancelAll = params?.cancelAll === true;

      const svc = getServiceOrThrow(runtime);
      const client = svc.getAuthenticatedClient();

      if (cancelAll) {
        await client.cancelAll();
        await invalidateCache(runtime);
        return { text: "All open orders cancelled.", success: true };
      }

      if (orderId) {
        await client.cancelOrder({ orderID: orderId });
        await invalidateCache(runtime);
        return {
          text: `Order ${orderId} cancelled.`,
          success: true,
          data: { orderId },
        };
      }

      // No orderId — list open orders so the agent can pick one
      const rawOrders = await client.getOpenOrders();
      const orders: OpenOrderLike[] =
        (rawOrders as any)?.data ?? rawOrders ?? [];
      if (!orders?.length) {
        return { text: "No open orders to cancel.", success: true };
      }

      const lines = orders.map(
        (o: OpenOrderLike) =>
          `  ${o.id}: ${o.side} ${o.original_size} @ ${o.price} (${o.order_type}, matched: ${o.size_matched})`,
      );
      return {
        text: `Open orders:\n${lines.join("\n")}\n\nProvide an orderId to cancel, or set cancelAll=true.`,
        success: true,
        data: { count: orders.length },
      };
    } catch (err) {
      return {
        text: `Cancel failed: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      };
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Cancel all my Polymarket orders" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "All open orders cancelled.",
          action: "CANCEL_POLYMARKET_ORDER",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Cancel order abc123 on Polymarket" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "Order abc123 cancelled.",
          action: "CANCEL_POLYMARKET_ORDER",
        },
      },
    ],
  ],
  parameters: [
    {
      name: "orderId",
      description: "Order ID to cancel (omit to list open orders)",
      required: false,
      schema: { type: "string" as const },
    },
    {
      name: "cancelAll",
      description: "Set to true to cancel ALL open orders",
      required: false,
      schema: { type: "boolean" as const },
    },
  ],
};
