/**
 * Polymarket Actions — extends @elizaos/plugin-polymarket with missing actions.
 *
 * The base plugin provides: GET_MARKETS, GET_TOKEN_INFO, GET_ORDER_BOOK_DEPTH,
 * PLACE_ORDER, GET_ORDER_DETAILS, CHECK_ORDER_SCORING, RESEARCH_MARKET.
 *
 * This extension adds the 5 missing actions for a complete trader lifecycle:
 *   1. GET_MARKET_RULES      — resolution rules & fine print (Gamma API)
 *   2. GET_PRICE_HISTORY      — historical candlestick data (CLOB)
 *   3. CANCEL_ORDER           — cancel resting limit orders (CLOB)
 *   4. GET_OPEN_ORDERS        — list unfilled orders (CLOB)
 *   5. GET_PORTFOLIO           — USDC balance + positions + P&L (CLOB)
 *
 * All actions use the existing PolymarketService via runtime.getService("polymarket").
 *
 * Auto-loaded when POLYMARKET_PRIVATE_KEY or EVM_PRIVATE_KEY is set.
 */
import { logger, type Plugin } from "@elizaos/core";
import { cancelOrderAction } from "./cancel-order.js";
import { getMarketRulesAction } from "./get-market-rules.js";
import { getOpenOrdersAction } from "./get-open-orders.js";
import { getPortfolioAction } from "./get-portfolio.js";
import { getPriceHistoryAction } from "./get-price-history.js";
import { getService } from "./service-helper.js";

const TAG = "[polymarket-actions]";

const actions = [
  getMarketRulesAction,
  getPriceHistoryAction,
  cancelOrderAction,
  getOpenOrdersAction,
  getPortfolioAction,
];

export const polymarketActionsPlugin: Plugin = {
  name: "polymarket-actions",
  description:
    "Extends @elizaos/plugin-polymarket with market rules, price history, cancel order, open orders, and portfolio actions",

  init: async (_config, runtime) => {
    const svc = getService(runtime);
    if (svc) {
      logger.info(
        `${TAG} Loaded — ${actions.length} actions registered (service: ready)`,
      );
    } else {
      logger.warn(
        `${TAG} Loaded — PolymarketService not found yet (actions will validate at call time)`,
      );
    }
  },

  actions,
};

export default polymarketActionsPlugin;
