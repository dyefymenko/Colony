/**
 * Kite x402 Payment Service
 *
 * Makes HTTP requests that may require x402 payment.
 * When a service returns HTTP 402, parses payment requirements,
 * executes a real on-chain KITE transfer on Kite testnet,
 * and retries with the payment proof (tx hash).
 *
 * Includes per-agent spending limits and insufficient funds handling.
 */

import { ethers } from 'ethers';
import {
  loadWalletState,
  getConnectedWallet,
  getKiteBalance,
  kiteExplorerTxUrl,
  getKiteProvider,
} from './kiteWallet';

export interface X402PaymentResult {
  success: boolean;
  response: any;
  amountPaid: string;
  txHash: string;
  kiteTxUrl: string;
  service: string;
}

interface AgentSpendingState {
  totalSpent: number;
  txCount: number;
  lastTx: string;
}

// ─── Spending Limits ────────────────────────────────────────────────────────

const DEFAULT_SPENDING_LIMIT = 1.0;  // max KITE per agent
const PER_TX_LIMIT = 0.2;           // max KITE per single x402 payment

const agentSpending: Map<string, AgentSpendingState> = new Map();

function getSpending(agentId: string): AgentSpendingState {
  if (!agentSpending.has(agentId)) {
    agentSpending.set(agentId, { totalSpent: 0, txCount: 0, lastTx: '' });
  }
  return agentSpending.get(agentId)!;
}

function checkSpendingLimit(agentId: string, amount: number): string | null {
  const spending = getSpending(agentId);

  if (amount > PER_TX_LIMIT) {
    return `Payment of ${amount} KITE exceeds per-transaction limit of ${PER_TX_LIMIT} KITE`;
  }

  if (spending.totalSpent + amount > DEFAULT_SPENDING_LIMIT) {
    return `Agent ${agentId} spending limit reached: ${spending.totalSpent.toFixed(4)}/${DEFAULT_SPENDING_LIMIT} KITE used`;
  }

  return null;
}

function recordSpending(agentId: string, amount: number, txHash: string): void {
  const spending = getSpending(agentId);
  spending.totalSpent += amount;
  spending.txCount += 1;
  spending.lastTx = txHash;
}

// ─── x402 Payment Client ───────────────────────────────────────────────────

export class KitePaymentService {
  /**
   * Make an HTTP request that may require x402 payment.
   * If the service returns 402, automatically pays via Kite testnet and retries.
   */
  async requestWithPayment(
    url: string,
    agentId: string,
    options?: RequestInit
  ): Promise<X402PaymentResult> {
    const hostname = new URL(url).hostname;

    // First request — may return 402
    const response = await fetch(url, options);

    if (response.status === 402) {
      return this.handlePaymentRequired(response, url, agentId, options);
    }

    // No payment required — return response as-is
    const responseData = await response.json().catch(() => ({ status: 'ok' }));
    return {
      success: true,
      response: responseData,
      amountPaid: '0',
      txHash: '',
      kiteTxUrl: '',
      service: hostname,
    };
  }

  /**
   * Handle a 402 Payment Required response:
   * 1. Parse payment requirements from headers
   * 2. Check agent has a Kite wallet and sufficient balance
   * 3. Check spending limits
   * 4. Execute real on-chain KITE payment
   * 5. Retry request with payment proof
   */
  private async handlePaymentRequired(
    response: Response,
    url: string,
    agentId: string,
    options?: RequestInit
  ): Promise<X402PaymentResult> {
    const hostname = new URL(url).hostname;

    // Parse payment requirements
    const paymentAmount = response.headers.get('X-Payment-Amount') || '0.005';
    const paymentAddress = response.headers.get('X-Payment-Address') || '';
    const paymentNetwork = response.headers.get('X-Payment-Network') || 'kite-testnet';

    console.log(`x402: ${hostname} requires ${paymentAmount} KITE (network: ${paymentNetwork})`);

    // Look up agent's Kite wallet
    const walletState = loadWalletState();
    if (!walletState) {
      throw new Error(
        'No Kite wallets configured. Run: npx tsx src/scripts/setup-kite-wallets.ts'
      );
    }

    // Find agent wallet by matching agentId or name
    const agentWallet = Object.values(walletState.agents).find(
      (w) => w.agentId === agentId || w.agentName.toLowerCase() === agentId.toLowerCase()
    );

    if (!agentWallet) {
      throw new Error(`No Kite wallet found for agent ${agentId}`);
    }

    const amount = parseFloat(paymentAmount);

    // Check spending limits
    const limitError = checkSpendingLimit(agentId, amount);
    if (limitError) {
      throw new Error(`x402 spending limit: ${limitError}`);
    }

    // Check balance
    const balance = await getKiteBalance(agentWallet.address);
    if (parseFloat(balance) < amount) {
      throw new Error(
        `Insufficient KITE balance for ${agentWallet.agentName}: ` +
        `have ${balance} KITE, need ${paymentAmount} KITE. ` +
        `Fund wallet ${agentWallet.address} at https://faucet.gokite.ai`
      );
    }

    // Determine payment recipient
    // Use the paymentAddress from the 402 header, or fall back to operator
    // Checksum the address so ethers doesn't attempt ENS resolution (Kite has no ENS)
    const recipient = ethers.getAddress(paymentAddress || walletState.operator.address);

    // Execute real on-chain KITE transfer
    const wallet = getConnectedWallet(agentWallet.privateKey);
    const txValue = ethers.parseEther(paymentAmount);

    const tx = await wallet.sendTransaction({
      to: recipient,
      value: txValue,
    });

    const receipt = await tx.wait();
    const txHash = receipt!.hash;
    const kiteTxUrl = kiteExplorerTxUrl(txHash);

    console.log(`x402 payment: ${paymentAmount} KITE from ${agentWallet.agentName} (tx: ${txHash})`);
    console.log(`  Verify: ${kiteTxUrl}`);

    // Record spending
    recordSpending(agentId, amount, txHash);

    // Retry request with payment proof
    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        'X-Payment-Proof': txHash,
        'X-Payment-Network': 'eip155:2368',
        'X-Payment-Agent': agentWallet.address,
      },
    });

    const responseData = await retryResponse.json().catch(() => ({ status: 'ok' }));

    return {
      success: true,
      response: responseData,
      amountPaid: paymentAmount,
      txHash,
      kiteTxUrl,
      service: hostname,
    };
  }

  /**
   * Get spending summary for an agent.
   */
  getAgentSpending(agentId: string): AgentSpendingState & { limit: number; remaining: number } {
    const spending = getSpending(agentId);
    return {
      ...spending,
      limit: DEFAULT_SPENDING_LIMIT,
      remaining: Math.max(0, DEFAULT_SPENDING_LIMIT - spending.totalSpent),
    };
  }
}
