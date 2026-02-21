/**
 * Base Sepolia Wallet Service
 *
 * Manages agent wallets on Base Sepolia testnet (EVM-compatible, chain ID 84532).
 * Each agent gets a real wallet with a verifiable address on sepolia.basescan.org.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { appendBuilderCode } from './builderCode';

const BASE_SEPOLIA_RPC = config.base?.rpcUrl || 'https://sepolia.base.org';
const BASE_CHAIN_ID = config.base?.chainId || 84532;
const BASE_EXPLORER = config.base?.explorerUrl || 'https://sepolia.basescan.org';

// Wallet state file
const WALLET_STATE_FILE = path.resolve(__dirname, '../../../base-wallets.json');

export interface BaseWalletInfo {
  address: string;
  privateKey: string;
  agentName: string;
  agentId?: string;
}

interface BaseWalletState {
  operator: BaseWalletInfo;
  agents: Record<string, BaseWalletInfo>; // keyed by agent name (lowercase)
  createdAt: string;
}

// ─── Provider ───────────────────────────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;

export function getBaseProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC, {
      name: 'base-sepolia',
      chainId: BASE_CHAIN_ID,
    });
  }
  return _provider;
}

// ─── Wallet Generation ──────────────────────────────────────────────────────

export function generateWallet(): BaseWalletInfo {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    agentName: '',
  };
}

export function getConnectedWallet(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey, getBaseProvider());
}

// ─── Wallet State Management ────────────────────────────────────────────────

export function loadBaseWalletState(): BaseWalletState | null {
  try {
    if (fs.existsSync(WALLET_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(WALLET_STATE_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveBaseWalletState(state: BaseWalletState): void {
  fs.writeFileSync(WALLET_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Generate wallets for the operator and all 5 agents.
 * Only generates once — subsequent calls return existing wallets.
 */
export function ensureBaseWallets(agentNames: string[]): BaseWalletState {
  const existing = loadBaseWalletState();
  if (existing) return existing;

  console.log('Generating Base Sepolia wallets...');

  const operator = generateWallet();
  operator.agentName = 'operator';

  const agents: Record<string, BaseWalletInfo> = {};
  for (const name of agentNames) {
    const wallet = generateWallet();
    wallet.agentName = name;
    agents[name.toLowerCase()] = wallet;
    console.log(`  ${name}: ${wallet.address}`);
  }

  const state: BaseWalletState = {
    operator,
    agents,
    createdAt: new Date().toISOString(),
  };

  saveBaseWalletState(state);
  console.log(`  Operator: ${operator.address}`);
  console.log(`Wallets saved to ${WALLET_STATE_FILE}`);
  return state;
}

// ─── Balance Checking ───────────────────────────────────────────────────────

export async function getBaseBalance(address: string): Promise<string> {
  const provider = getBaseProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

// ─── ETH Transfer (Real On-Chain) ───────────────────────────────────────────

export async function transferBase(
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
      `Insufficient ETH balance on Base Sepolia: have ${ethers.formatEther(balance)}, need ${amountEther}. ` +
      `Fund wallet ${wallet.address} at https://portal.cdp.coinbase.com/products/faucet`
    );
  }

  const tx = await wallet.sendTransaction({
    to: ethers.getAddress(toAddress),
    value: amount,
    data: appendBuilderCode('0x'),
  });

  const receipt = await tx.wait();
  const txHash = receipt!.hash;

  console.log(`Base ETH transfer: ${ethers.formatEther(amount)} ETH → ${toAddress} (tx: ${txHash})`);
  return { txHash, amount: amountEther };
}

// ─── Fund Agent Wallets from Operator ───────────────────────────────────────

export async function fundBaseAgentWallets(amountPerAgent: string = '0.000005'): Promise<void> {
  const state = loadBaseWalletState();
  if (!state) throw new Error('No Base wallet state found. Run wallet generation first.');

  const operatorBalance = await getBaseBalance(state.operator.address);
  console.log(`Operator balance: ${operatorBalance} ETH`);

  if (parseFloat(operatorBalance) < parseFloat(amountPerAgent) * Object.keys(state.agents).length) {
    console.log(`\nInsufficient operator balance. Fund the operator wallet:`);
    console.log(`  Address: ${state.operator.address}`);
    console.log(`  Faucet: https://portal.cdp.coinbase.com/products/faucet`);
    return;
  }

  for (const [name, wallet] of Object.entries(state.agents)) {
    try {
      const { txHash } = await transferBase(state.operator.privateKey, wallet.address, amountPerAgent);
      console.log(`Funded ${name}: ${amountPerAgent} ETH (tx: ${txHash})`);
    } catch (err: any) {
      console.error(`Failed to fund ${name}: ${err.message}`);
    }
  }
}

// ─── Explorer URLs ──────────────────────────────────────────────────────────

export function baseExplorerTxUrl(txHash: string): string {
  return `${BASE_EXPLORER}/tx/${txHash}`;
}

export function baseExplorerAddressUrl(address: string): string {
  return `${BASE_EXPLORER}/address/${address}`;
}

export { BASE_SEPOLIA_RPC, BASE_CHAIN_ID, BASE_EXPLORER };
