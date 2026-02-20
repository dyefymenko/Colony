/**
 * Base Sepolia Wallet Setup Script
 *
 * Generates Base Sepolia wallets for the operator and all 5 agents.
 * After running, fund the operator wallet via the Base Sepolia faucet
 * then run this script again with --fund to distribute ETH to agents.
 *
 * Usage:
 *   npx tsx src/scripts/setup-base-wallets.ts          # Generate wallets
 *   npx tsx src/scripts/setup-base-wallets.ts --fund    # Fund agent wallets
 *   npx tsx src/scripts/setup-base-wallets.ts --status  # Check balances
 */

import {
  ensureBaseWallets,
  fundBaseAgentWallets,
  getBaseBalance,
  baseExplorerAddressUrl,
  BASE_EXPLORER,
} from '../services/baseWallet';

const AGENT_NAMES = ['Codex', 'Sentry', 'Scraper', 'Quill', 'Argus'];

async function main() {
  const arg = process.argv[2];

  console.log('=== Base Sepolia Wallet Setup ===\n');
  console.log(`Network: Base Sepolia (chain ID 84532)`);
  console.log(`Explorer: ${BASE_EXPLORER}`);
  console.log(`Faucet: https://portal.cdp.coinbase.com/products/faucet\n`);

  // Generate wallets (idempotent)
  const state = ensureBaseWallets(AGENT_NAMES);

  if (arg === '--fund') {
    console.log('\n--- Funding agent wallets ---\n');
    await fundBaseAgentWallets('0.000005');
    console.log('\nDone. Run with --status to verify balances.');
    return;
  }

  if (arg === '--status') {
    console.log('\n--- Wallet Balances ---\n');

    const opBal = await getBaseBalance(state.operator.address);
    console.log(`  Operator: ${state.operator.address}`);
    console.log(`    Balance: ${opBal} ETH`);
    console.log(`    Explorer: ${baseExplorerAddressUrl(state.operator.address)}\n`);

    for (const [name, wallet] of Object.entries(state.agents)) {
      const bal = await getBaseBalance(wallet.address);
      console.log(`  ${name}: ${wallet.address}`);
      console.log(`    Balance: ${bal} ETH`);
      console.log(`    Explorer: ${baseExplorerAddressUrl(wallet.address)}`);
    }
    return;
  }

  // Default: show wallet info and next steps
  console.log('\n--- Wallets ---\n');
  console.log(`  Operator: ${state.operator.address}`);
  for (const [name, wallet] of Object.entries(state.agents)) {
    console.log(`  ${name}: ${wallet.address}`);
  }

  console.log('\n--- Next Steps ---\n');
  console.log('  1. Fund the OPERATOR wallet with testnet ETH:');
  console.log(`     Go to: https://portal.cdp.coinbase.com/products/faucet`);
  console.log(`     Paste: ${state.operator.address}\n`);
  console.log('  2. Distribute ETH to agent wallets:');
  console.log('     npx tsx src/scripts/setup-base-wallets.ts --fund\n');
  console.log('  3. Verify balances:');
  console.log('     npx tsx src/scripts/setup-base-wallets.ts --status\n');
}

main().catch(console.error);
