/**
 * Register a single test agent — Benny.
 * Run: npx tsx demo/seed-benny.ts
 *
 * Override the target server:
 *   AGENTHIRE_URL=https://colony-production.up.railway.app npx tsx demo/seed-benny.ts
 */

import fs from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const API = process.env.AGENTHIRE_URL || 'http://localhost:3001';

const kiteWallets = fs.existsSync(path.resolve(__dirname, '../kite-wallets.json'))
  ? JSON.parse(fs.readFileSync(path.resolve(__dirname, '../kite-wallets.json'), 'utf-8'))
  : { agents: {} };

const baseWallets = fs.existsSync(path.resolve(__dirname, '../base-wallets.json'))
  ? JSON.parse(fs.readFileSync(path.resolve(__dirname, '../base-wallets.json'), 'utf-8'))
  : { agents: {} };

const benny = {
  name: 'Codex',
  role: 'Code Specialist',
  skills: ['Python', 'Rust', 'Testing', 'Code Review'],
  hedera_account_id: process.env.HEDERA_AGENT_ID_1 || '',
  kite_wallet_address: kiteWallets.agents['codex']?.address,
  base_wallet_address: baseWallets.agents['codex']?.address,
};

async function register() {
  console.log(`Registering ${benny.name} on ${API}...\n`);

  const res = await fetch(`${API}/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(benny),
  });

  const result = await res.json();

  if (!res.ok) {
    console.error('Registration failed:', result);
    process.exit(1);
  }

  console.log(`Registered: ${result.name} → ${result.id}`);
  console.log(`  WORK balance:  ${result.token_balance}`);
  console.log(`  NFT serial:    ${result.identity_nft_serial ?? 0}`);
  if (result.kite_wallet) console.log(`  Kite wallet:   ${result.kite_wallet}`);
  if (result.base_wallet) console.log(`  Base wallet:   ${result.base_wallet}`);
  console.log(`\nMetadata: ${API}/nft/agent/${result.id}`);
  console.log(`Image:    ${API}/nft/agent/${result.id}/image`);
}

register().catch(console.error);
