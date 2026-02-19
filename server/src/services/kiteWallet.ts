/**
 * Kite Wallet Service
 *
 * Manages agent wallets on Kite testnet (EVM-compatible, chain ID 2368).
 * Each agent gets a real wallet with a verifiable address on kitescan.ai.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const KITE_TESTNET_RPC = 'https://rpc-testnet.gokite.ai/';
const KITE_CHAIN_ID = 2368;
const KITE_EXPLORER = 'https://testnet.kitescan.ai';

// Wallet state file
const WALLET_STATE_FILE = path.resolve(__dirname, '../../../kite-wallets.json');

export interface KiteWalletInfo {
  address: string;
  privateKey: string;
  agentName: string;
  agentId?: string;
}

interface KiteWalletState {
  operator: KiteWalletInfo;
  agents: Record<string, KiteWalletInfo>; // keyed by agent name (lowercase)
  createdAt: string;
}

// ─── Provider ───────────────────────────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;

export function getKiteProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(KITE_TESTNET_RPC, {
      name: 'kite-testnet',
      chainId: KITE_CHAIN_ID,
    });
  }
  return _provider;
}

// ─── Wallet Generation ──────────────────────────────────────────────────────

export function generateWallet(): KiteWalletInfo {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    agentName: '',
  };
}

export function getConnectedWallet(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey, getKiteProvider());
}

// ─── Wallet State Management ────────────────────────────────────────────────

export function loadWalletState(): KiteWalletState | null {
  try {
    if (fs.existsSync(WALLET_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(WALLET_STATE_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveWalletState(state: KiteWalletState): void {
  fs.writeFileSync(WALLET_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Generate wallets for the operator and all 5 agents.
 * Only generates once — subsequent calls return existing wallets.
 */
export function ensureWallets(agentNames: string[]): KiteWalletState {
  const existing = loadWalletState();
  if (existing) return existing;

  console.log('Generating Kite testnet wallets...');

  const operator = generateWallet();
  operator.agentName = 'operator';

  const agents: Record<string, KiteWalletInfo> = {};
  for (const name of agentNames) {
    const wallet = generateWallet();
    wallet.agentName = name;
    agents[name.toLowerCase()] = wallet;
    console.log(`  ${name}: ${wallet.address}`);
  }

  const state: KiteWalletState = {
    operator,
    agents,
    createdAt: new Date().toISOString(),
  };

  saveWalletState(state);
  console.log(`  Operator: ${operator.address}`);
  console.log(`Wallets saved to ${WALLET_STATE_FILE}`);
  return state;
}

// ─── Balance Checking ───────────────────────────────────────────────────────

export async function getKiteBalance(address: string): Promise<string> {
  const provider = getKiteProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

// ─── KITE Transfer (Real On-Chain) ──────────────────────────────────────────

export async function transferKite(
  fromPrivateKey: string,
  toAddress: string,
  amountEther: string
): Promise<{ txHash: string; amount: string }> {
  const wallet = getConnectedWallet(fromPrivateKey);
  const amount = ethers.parseEther(amountEther);

  // Check balance first
  const balance = await wallet.provider!.getBalance(wallet.address);
  if (balance < amount) {
    throw new Error(
      `Insufficient KITE balance: have ${ethers.formatEther(balance)}, need ${amountEther}. ` +
      `Fund wallet ${wallet.address} at https://faucet.gokite.ai`
    );
  }

  const tx = await wallet.sendTransaction({
    to: ethers.getAddress(toAddress),
    value: amount,
  });

  const receipt = await tx.wait();
  const txHash = receipt!.hash;

  console.log(`KITE transfer: ${ethers.formatEther(amount)} KITE → ${toAddress} (tx: ${txHash})`);
  return { txHash, amount: amountEther };
}

// ─── Fund Agent Wallets from Operator ───────────────────────────────────────

export async function fundAgentWallets(amountPerAgent: string = '0.1'): Promise<void> {
  const state = loadWalletState();
  if (!state) throw new Error('No wallet state found. Run wallet generation first.');

  const operatorBalance = await getKiteBalance(state.operator.address);
  console.log(`Operator balance: ${operatorBalance} KITE`);

  if (parseFloat(operatorBalance) < parseFloat(amountPerAgent) * Object.keys(state.agents).length) {
    console.log(`\nInsufficient operator balance. Fund the operator wallet:`);
    console.log(`  Address: ${state.operator.address}`);
    console.log(`  Faucet: https://faucet.gokite.ai`);
    return;
  }

  for (const [name, wallet] of Object.entries(state.agents)) {
    try {
      const { txHash } = await transferKite(state.operator.privateKey, wallet.address, amountPerAgent);
      console.log(`Funded ${name}: ${amountPerAgent} KITE (tx: ${txHash})`);
    } catch (err: any) {
      console.error(`Failed to fund ${name}: ${err.message}`);
    }
  }
}

// ─── Explorer URLs ──────────────────────────────────────────────────────────

export function kiteExplorerTxUrl(txHash: string): string {
  return `${KITE_EXPLORER}/tx/${txHash}`;
}

export function kiteExplorerAddressUrl(address: string): string {
  return `${KITE_EXPLORER}/address/${address}`;
}

export { KITE_TESTNET_RPC, KITE_CHAIN_ID, KITE_EXPLORER };
