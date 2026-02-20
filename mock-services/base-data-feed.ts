import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const PORT = 3013;

function loadPaymentAddress(): string {
  if (process.env.PAYMENT_ADDRESS) return process.env.PAYMENT_ADDRESS;
  try {
    const wallets = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../base-wallets.json'), 'utf-8'));
    return wallets.operator.address;
  } catch {
    console.warn('[base-data-feed] No base-wallets.json found — run setup-base-wallets.ts first');
    return '0x0000000000000000000000000000000000000000';
  }
}

const PAYMENT_ADDRESS = loadPaymentAddress();

/**
 * Mock Data Feed API with x402 payment gate on Base Sepolia.
 */
app.get('/market', (req, res) => {
  const paymentProof = req.headers['x-payment-proof'] as string | undefined;
  const paymentAgent = req.headers['x-payment-agent'] as string | undefined;

  if (!paymentProof) {
    res.status(402);
    res.setHeader('X-Payment-Required', 'true');
    res.setHeader('X-Payment-Amount', '0.000001');
    res.setHeader('X-Payment-Address', PAYMENT_ADDRESS);
    res.setHeader('X-Payment-Network', 'eip155:84532');
    res.setHeader('X-Payment-Token', 'ETH');
    res.setHeader('X-Payment-Description', 'Real-time market data feed (Base Sepolia)');
    return res.json({
      error: 'Payment Required',
      x402: {
        amount: '0.000001',
        currency: 'ETH',
        network: 'eip155:84532',
        description: 'Pay 0.000001 ETH on Base Sepolia for real-time market data',
        explorer: 'https://sepolia.basescan.org',
      },
    });
  }

  if (!paymentProof.startsWith('0x') || paymentProof.length < 10) {
    return res.status(400).json({ error: 'Invalid payment proof' });
  }

  console.log(`[base-data-feed] Payment verified:`);
  console.log(`  Agent: ${paymentAgent || 'unknown'}`);
  console.log(`  Tx: ${paymentProof}`);
  console.log(`  Verify: https://sepolia.basescan.org/tx/${paymentProof}`);

  res.json({
    data: [
      { symbol: 'ETH', price: 3842.50, change_24h: -1.3, volume: '18.2B' },
      { symbol: 'BTC', price: 97250.00, change_24h: 2.1, volume: '42.5B' },
      { symbol: 'BASE', price: 1.05, change_24h: 3.7, volume: '890M' },
      { symbol: 'USDC', price: 1.00, change_24h: 0.0, volume: '5.1B' },
    ],
    timestamp: new Date().toISOString(),
    payment: { tx_hash: paymentProof, agent: paymentAgent, verified: true },
  });
});

app.get('/health', (_req, res) => res.json({ service: 'base-data-feed', status: 'ok', network: 'base-sepolia' }));

app.listen(PORT, () => {
  console.log(`Mock Base Data Feed (x402-gated) running on port ${PORT}`);
  console.log(`  Network: Base Sepolia (eip155:84532)`);
  console.log(`  Payment address: ${PAYMENT_ADDRESS}`);
});
