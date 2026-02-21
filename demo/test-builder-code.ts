/**
 * ERC-8021 Builder Code verification script.
 *
 * Sends a 0-ETH self-transfer on Base Sepolia with the builder code suffix
 * appended to calldata. Open the BaseScan link and check "Input Data" to
 * confirm the suffix is present.
 *
 * Run: npx tsx demo/test-builder-code.ts
 */

import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_SEPOLIA_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const BASE_CHAIN_ID = parseInt(process.env.BASE_CHAIN_ID || '8453', 10);
const BASE_EXPLORER = process.env.BASE_EXPLORER_URL || 'https://basescan.org';

const walletFile = path.resolve(__dirname, '../base-wallets.json');
const wallets = JSON.parse(fs.readFileSync(walletFile, 'utf-8'));
const operator = wallets.operator;

// ─── ERC-8021 Suffix ─────────────────────────────────────────────────────────

const ERC_MARKER = Buffer.from('80218021802180218021802180218021', 'hex');
const SCHEMA_CANONICAL = Buffer.from([0x00]);

function buildSuffix(code: string): string {
  const codeBytes = Buffer.from(code, 'ascii');
  const codesLength = Buffer.from([codeBytes.length]);
  const suffix = Buffer.concat([codesLength, codeBytes, SCHEMA_CANONICAL, ERC_MARKER]);
  return '0x' + suffix.toString('hex');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const code = process.env.BASE_BUILDER_CODE || 'colony';
  const suffix = buildSuffix(code);

  console.log('ERC-8021 Builder Code Test');
  console.log('==========================');
  console.log(`Code:   "${code}"`);
  console.log(`Suffix: ${suffix}`);
  console.log();

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC, {
    name: 'base-sepolia',
    chainId: BASE_CHAIN_ID,
  });

  const wallet = new ethers.Wallet(operator.privateKey, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log('\nNo ETH on Base Sepolia. Fund the operator wallet first:');
    console.log(`  https://portal.cdp.coinbase.com/products/faucet`);
    console.log(`  Address: ${wallet.address}`);
    process.exit(1);
  }

  console.log('\nSending 0-ETH self-transfer with builder code suffix...');

  const tx = await wallet.sendTransaction({
    to: wallet.address,
    value: 0n,
    data: suffix,
  });

  console.log(`\nTx hash: ${tx.hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await tx.wait();
  const txUrl = `${BASE_EXPLORER}/tx/${receipt!.hash}`;

  console.log(`\nConfirmed in block ${receipt!.blockNumber}`);
  console.log(`\nVerify on BaseScan:`);
  console.log(`  ${txUrl}`);
  console.log(`\nOn that page, click "More Details" and check "Input Data".`);
  console.log(`You should see: ${suffix}`);
}

main().catch(console.error);
