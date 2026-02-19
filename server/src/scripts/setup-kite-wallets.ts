/**
 * Kite Wallet Setup Script
 *
 * Generates Kite testnet wallets for the operator and all 5 agents.
 * After running, fund the operator wallet via https://faucet.gokite.ai
 * then run this script again with --fund to distribute KITE to agents.
 *
 * Usage:
 *   npx tsx src/scripts/setup-kite-wallets.ts          # Generate wallets
 *   npx tsx src/scripts/setup-kite-wallets.ts --fund    # Fund agent wallets
 *   npx tsx src/scripts/setup-kite-wallets.ts --status  # Check balances
 */

import {
  ensureWallets,
  fundAgentWallets,
  getKiteBalance,
  kiteExplorerAddressUrl,
  KITE_EXPLORER,
} from '../services/kiteWallet';

const AGENT_NAMES = ['Codex', 'Sentry', 'Scraper', 'Quill', 'Argus'];

async function main() {
  const arg = process.argv[2];

  console.log('=== Kite Testnet Wallet Setup ===\n');
  console.log(`Network: Kite Testnet (chain ID 2368)`);
  console.log(`Explorer: ${KITE_EXPLORER}`);
  console.log(`Faucet: https://faucet.gokite.ai\n`);

  // Generate wallets (idempotent)
  const state = ensureWallets(AGENT_NAMES);

  if (arg === '--fund') {
    console.log('\n--- Funding agent wallets ---\n');
    await fundAgentWallets('0.05');
    console.log('\nDone. Run with --status to verify balances.');
    return;
  }

  if (arg === '--status') {
    console.log('\n--- Wallet Balances ---\n');

    const opBal = await getKiteBalance(state.operator.address);
    console.log(`  Operator: ${state.operator.address}`);
    console.log(`    Balance: ${opBal} KITE`);
    console.log(`    Explorer: ${kiteExplorerAddressUrl(state.operator.address)}\n`);

    for (const [name, wallet] of Object.entries(state.agents)) {
      const bal = await getKiteBalance(wallet.address);
      console.log(`  ${name}: ${wallet.address}`);
      console.log(`    Balance: ${bal} KITE`);
      console.log(`    Explorer: ${kiteExplorerAddressUrl(wallet.address)}`);
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
  console.log('  1. Fund the OPERATOR wallet with testnet KITE:');
  console.log(`     Go to: https://faucet.gokite.ai`);
  console.log(`     Paste: ${state.operator.address}\n`);
  console.log('  2. Distribute KITE to agent wallets:');
  console.log('     npx tsx src/scripts/setup-kite-wallets.ts --fund\n');
  console.log('  3. Verify balances:');
  console.log('     npx tsx src/scripts/setup-kite-wallets.ts --status\n');
}

main().catch(console.error);
