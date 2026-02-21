/**
 * Base Sepolia x402 Payment Service
 *
 * Makes HTTP requests that may require x402 payment.
 * When a service returns HTTP 402, parses payment requirements,
 * executes a real on-chain ETH transfer on Base Sepolia,
 * and retries with the payment proof (tx hash).
 *
 * Includes per-agent spending limits and insufficient funds handling.
 */

import { ethers } from 'ethers';
import {
  loadBaseWalletState,
  getConnectedWallet,
  getBaseBalance,
  baseExplorerTxUrl,
} from './baseWallet';
import { appendBuilderCode } from './builderCode';

export interface BaseX402PaymentResult {
  success: boolean;
  response: any;
  amountPaid: string;
  txHash: string;
  baseTxUrl: string;
  service: string;
}

interface AgentSpendingState {
  totalSpent: number;
  txCount: number;
  lastTx: string;
}

// ─── Spending Limits ────────────────────────────────────────────────────────

const DEFAULT_SPENDING_LIMIT = 1.0;  // max ETH per agent
const PER_TX_LIMIT = 0.2;           // max ETH per single x402 payment

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
    return `Payment of ${amount} ETH exceeds per-transaction limit of ${PER_TX_LIMIT} ETH`;
  }

  if (spending.totalSpent + amount > DEFAULT_SPENDING_LIMIT) {
    return `Agent ${agentId} spending limit reached: ${spending.totalSpent.toFixed(4)}/${DEFAULT_SPENDING_LIMIT} ETH used`;
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

export class BasePaymentService {
  /**
   * Make an HTTP request that may require x402 payment.
   * If the service returns 402, automatically pays via Base Sepolia and retries.
   */
  async requestWithPayment(
    url: string,
    agentId: string,
    options?: RequestInit
  ): Promise<BaseX402PaymentResult> {
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
      baseTxUrl: '',
      service: hostname,
    };
  }

  /**
   * Handle a 402 Payment Required response:
   * 1. Parse payment requirements from headers
   * 2. Check agent has a Base wallet and sufficient balance
   * 3. Check spending limits
   * 4. Execute real on-chain ETH payment on Base Sepolia
   * 5. Retry request with payment proof
   */
  private async handlePaymentRequired(
    response: Response,
    url: string,
    agentId: string,
    options?: RequestInit
  ): Promise<BaseX402PaymentResult> {
    const hostname = new URL(url).hostname;

    // Parse payment requirements
    const paymentAmount = response.headers.get('X-Payment-Amount') || '0.000001';
    const paymentAddress = response.headers.get('X-Payment-Address') || '';
    const paymentNetwork = response.headers.get('X-Payment-Network') || 'eip155:84532';

    console.log(`x402: ${hostname} requires ${paymentAmount} ETH on Base Sepolia (network: ${paymentNetwork})`);

    // Look up agent's Base wallet
    const walletState = loadBaseWalletState();
    if (!walletState) {
      throw new Error(
        'No Base wallets configured. Run: npx tsx src/scripts/setup-base-wallets.ts'
      );
    }

    // Find agent wallet by matching agentId or name
    const agentWallet = Object.values(walletState.agents).find(
      (w) => w.agentId === agentId || w.agentName.toLowerCase() === agentId.toLowerCase()
    );

    if (!agentWallet) {
      throw new Error(`No Base wallet found for agent ${agentId}`);
    }

    const amount = parseFloat(paymentAmount);

    // Check spending limits
    const limitError = checkSpendingLimit(agentId, amount);
    if (limitError) {
      throw new Error(`x402 spending limit: ${limitError}`);
    }

    // Check balance
    const balance = await getBaseBalance(agentWallet.address);
    if (parseFloat(balance) < amount) {
      throw new Error(
        `Insufficient ETH balance on Base Sepolia for ${agentWallet.agentName}: ` +
        `have ${balance} ETH, need ${paymentAmount} ETH. ` +
        `Fund wallet ${agentWallet.address} at https://portal.cdp.coinbase.com/products/faucet`
      );
    }

    // Determine payment recipient
    const recipient = ethers.getAddress(paymentAddress || walletState.operator.address);

    // Execute real on-chain ETH transfer on Base Sepolia
    const wallet = getConnectedWallet(agentWallet.privateKey);
    const txValue = ethers.parseEther(paymentAmount);

    const tx = await wallet.sendTransaction({
      to: recipient,
      value: txValue,
      data: appendBuilderCode('0x'),
    });

    const receipt = await tx.wait();
    const txHash = receipt!.hash;
    const baseTxUrl = baseExplorerTxUrl(txHash);

    console.log(`x402 payment: ${paymentAmount} ETH (Base Sepolia) from ${agentWallet.agentName} (tx: ${txHash})`);
    console.log(`  Verify: ${baseTxUrl}`);

    // Record spending
    recordSpending(agentId, amount, txHash);

    // Retry request with payment proof
    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        'X-Payment-Proof': txHash,
        'X-Payment-Network': 'eip155:84532',
        'X-Payment-Agent': agentWallet.address,
      },
    });

    const responseData = await retryResponse.json().catch(() => ({ status: 'ok' }));

    return {
      success: true,
      response: responseData,
      amountPaid: paymentAmount,
      txHash,
      baseTxUrl,
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
