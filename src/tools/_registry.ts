/** Central tool registry — registers all MCP tools on a single McpServer instance. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerQuote } from "./trading/quote.js";
import { registerSwap } from "./trading/swap.js";

import { registerLaunchFeed } from "./launch/feed.js";
import { registerCreateTokenInfo } from "./launch/create-info.js";
import { registerCreateLaunchTx } from "./launch/create-tx.js";
import { registerLaunchTokenFull } from "./launch/launch-full.js";

import { registerResolveWallet } from "./fees/resolve-wallet.js";
import { registerResolveWalletsBulk } from "./fees/resolve-bulk.js";
import { registerCreateFeeConfig } from "./fees/create-config.js";
import { registerComposeFeeConfig } from "./fees/compose.js";
import { registerFeeAdminList } from "./fees/admin-list.js";
import { registerFeeAdminTransfer } from "./fees/admin-transfer.js";
import { registerFeeAdminUpdate } from "./fees/admin-update.js";
import { registerClaimEvents } from "./fees/claim-events.js";

import { registerClaimablePositions } from "./claiming/positions.js";
import { registerClaimFees } from "./claiming/claim.js";
import { registerClaimAllFees } from "./claiming/claim-all.js";

import { registerPartnerStats } from "./partner/stats.js";
import { registerPartnerClaim } from "./partner/claim.js";
import { registerPartnerConfig } from "./partner/config.js";

import { registerDexscreenerCheck } from "./dexscreener/availability.js";
import { registerDexscreenerOrder } from "./dexscreener/order.js";
import { registerDexscreenerPayment } from "./dexscreener/payment.js";

import { registerAgentAuthInit } from "./agent/auth-init.js";
import { registerAgentAuthLogin } from "./agent/auth-login.js";
import { registerAgentWalletList } from "./agent/wallet-list.js";
import { registerAgentWalletExport } from "./agent/wallet-export.js";
import { registerAgentKeysList } from "./agent/keys-list.js";
import { registerAgentKeysCreate } from "./agent/keys-create.js";
import { registerAgentBootstrap } from "./agent/bootstrap.js";

import { registerPools } from "./state/pools.js";
import { registerPool } from "./state/pool.js";
import { registerPoolConfigKeys } from "./state/pool-config.js";

import { registerTokenCreators } from "./analytics/creators.js";
import { registerLifetimeFees } from "./analytics/lifetime-fees.js";
import { registerClaimStats } from "./analytics/claim-stats.js";
import { registerTopTokens } from "./analytics/top-tokens.js";

import { registerSendTransaction } from "./solana/send-tx.js";
import { registerWalletBalance } from "./solana/balance.js";
import { registerTokenHoldings } from "./solana/holdings.js";

import { registerOpenSigningPage } from "./signing/open-signing-page.js";
import { registerOpenLaunchPage } from "./signing/open-launch-page.js";
import { registerToolCatalog } from "./meta/catalog.js";

import { registerScoutScan } from "./scout/scan.js";
import { registerScoutLaunch } from "./scout/launch.js";
import { registerGenerateTokenImage } from "./scout/generate-image.js";

/**
 * Register all MCP tools on the given server.
 * @param server - The McpServer instance to register tools on.
 */
export function registerAllTools(server: McpServer) {
  registerQuote(server);
  registerSwap(server);

  registerLaunchFeed(server);
  registerCreateTokenInfo(server);
  registerCreateLaunchTx(server);
  registerLaunchTokenFull(server);

  registerResolveWallet(server);
  registerResolveWalletsBulk(server);
  registerCreateFeeConfig(server);
  registerComposeFeeConfig(server);
  registerFeeAdminList(server);
  registerFeeAdminTransfer(server);
  registerFeeAdminUpdate(server);
  registerClaimEvents(server);

  registerClaimablePositions(server);
  registerClaimFees(server);
  registerClaimAllFees(server);

  registerPartnerStats(server);
  registerPartnerClaim(server);
  registerPartnerConfig(server);

  registerDexscreenerCheck(server);
  registerDexscreenerOrder(server);
  registerDexscreenerPayment(server);

  registerAgentAuthInit(server);
  registerAgentAuthLogin(server);
  registerAgentWalletList(server);
  registerAgentWalletExport(server);
  registerAgentKeysList(server);
  registerAgentKeysCreate(server);
  registerAgentBootstrap(server);

  registerPools(server);
  registerPool(server);
  registerPoolConfigKeys(server);

  registerTokenCreators(server);
  registerLifetimeFees(server);
  registerClaimStats(server);
  registerTopTokens(server);

  registerSendTransaction(server);
  registerWalletBalance(server);
  registerTokenHoldings(server);

  registerOpenSigningPage(server);
  registerOpenLaunchPage(server);
  registerToolCatalog(server);

  registerScoutScan(server);
  registerScoutLaunch(server);
  registerGenerateTokenImage(server);
}
