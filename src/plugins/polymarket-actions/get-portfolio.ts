/**
 * GET_POLYMARKET_PORTFOLIO — checks USDC balance, positions, and open orders.
 *
 * Uses the existing PolymarketService's cached account state for fast reads,
 * falling back to a fresh refresh if cache is stale.
 * Resolves token/market IDs to human-readable names via Gamma API.
 */
import type { Action, HandlerOptions } from "@elizaos/core";
import {
  canTrade,
  getServiceOrThrow,
  resolveMarketName,
  type OpenOrderLike,
} from "./service-helper.js";

export const getPortfolioAction: Action = {
  name: "GET_POLYMARKET_PORTFOLIO",
  similes: [
    "POLYMARKET_PORTFOLIO",
    "POLYMARKET_BALANCE",
    "POLYMARKET_POSITIONS",
    "POLYMARKET_HOLDINGS",
    "POLYMARKET_MY_BETS",
    "POLYMARKET_ACCOUNT",
    "POLYMARKET_WALLET_STATUS",
  ],
  description:
    "Check the agent's Polymarket portfolio: USDC balance, active token positions with P&L, and open orders summary. Gives a full picture of current account state.",
  validate: async (runtime) => canTrade(runtime),
  handler: async (runtime, _message, _state, options) => {
    try {
      const params = (options as HandlerOptions | undefined)?.parameters;
      const detailed = params?.detailed === true;

      const svc = getServiceOrThrow(runtime);
      const accountState = await svc.getAccountState();

      if (!accountState) {
        return {
          text: "Could not retrieve account state. Ensure Polymarket credentials are configured.",
          success: false,
        };
      }

      const lines: string[] = [];

      // USDC Balance
      const collateral = accountState.balances?.collateral;
      if (collateral) {
        lines.push(`USDC Balance: $${collateral.balance}`);
      } else {
        lines.push("USDC Balance: unavailable");
      }

      // Positions — resolve market names
      const positions = accountState.positions ?? [];
      if (positions.length > 0) {
        // Resolve unique market IDs to names (best-effort, parallel)
        const uniqueMarkets = [
          ...new Set(positions.map((p) => p.market).filter(Boolean)),
        ];
        const nameMap = new Map<string, string>();
        await Promise.allSettled(
          uniqueMarkets.map(async (m) => {
            const name = await resolveMarketName(m);
            if (name) nameMap.set(m, name);
          }),
        );

        lines.push(`\nPositions (${positions.length}):`);
        for (const pos of positions) {
          const size = Number(pos.size);
          const avgPrice = Number(pos.average_price);
          const value = size * avgPrice;
          const realizedPnl = Number(pos.realized_pnl);
          const pnlSign = realizedPnl >= 0 ? "+" : "";
          const marketLabel =
            nameMap.get(pos.market) ?? pos.market?.slice(0, 16) + "...";
          lines.push(
            `  ${marketLabel} — ${size.toFixed(1)} shares @ avg ${avgPrice.toFixed(3)} ($${value.toFixed(2)}) | P&L: ${pnlSign}$${realizedPnl.toFixed(2)}`,
          );
          if (detailed) {
            lines.push(`    asset: ${pos.asset_id} | market: ${pos.market}`);
          }
        }
      } else {
        lines.push("\nNo active positions.");
      }

      // Open Orders
      const openOrders = accountState.activeOrders ?? [];
      if (openOrders.length > 0) {
        const buyOrders = openOrders.filter(
          (o: OpenOrderLike) => o.side === "BUY",
        );
        const sellOrders = openOrders.filter(
          (o: OpenOrderLike) => o.side === "SELL",
        );
        const lockedValue = openOrders.reduce(
          (sum: number, o: OpenOrderLike) =>
            sum +
            (Number(o.original_size) - Number(o.size_matched)) *
              Number(o.price),
          0,
        );
        lines.push(
          `\nOpen Orders: ${openOrders.length} (${buyOrders.length} buys, ${sellOrders.length} sells)`,
        );
        lines.push(`  Locked in orders: ~$${lockedValue.toFixed(2)}`);

        if (detailed) {
          for (const o of openOrders.slice(0, 5) as OpenOrderLike[]) {
            lines.push(
              `  ${o.side} ${o.original_size} @ ${o.price} (${o.order_type}) — ${o.id.slice(0, 16)}...`,
            );
          }
          if (openOrders.length > 5) {
            lines.push(`  ... +${openOrders.length - 5} more`);
          }
        }
      } else {
        lines.push("\nNo open orders.");
      }

      // Summary
      const balanceUsd = collateral ? Number(collateral.balance) : 0;
      const positionValue = positions.reduce(
        (sum, p) => sum + Number(p.size) * Number(p.average_price),
        0,
      );
      lines.push(
        `\nTotal account value: ~$${(balanceUsd + positionValue).toFixed(2)}`,
      );

      return {
        text: lines.join("\n"),
        success: true,
        data: {
          usdcBalance: balanceUsd,
          positionCount: positions.length,
          openOrderCount: openOrders.length,
          totalValue: balanceUsd + positionValue,
        },
      };
    } catch (err) {
      return {
        text: `Failed to fetch portfolio: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      };
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Show my Polymarket portfolio" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "USDC Balance: $42.50\n\nPositions (1): ...",
          action: "GET_POLYMARKET_PORTFOLIO",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "What's my Polymarket balance?" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "USDC Balance: $100.00\n\nNo active positions.",
          action: "GET_POLYMARKET_PORTFOLIO",
        },
      },
    ],
  ],
  parameters: [
    {
      name: "detailed",
      description: "Show detailed order/position info (default false)",
      required: false,
      schema: { type: "boolean" as const },
    },
  ],
};
