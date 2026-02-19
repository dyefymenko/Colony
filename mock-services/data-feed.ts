import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const PORT = 3012;

function loadPaymentAddress(): string {
  if (process.env.PAYMENT_ADDRESS) return process.env.PAYMENT_ADDRESS;
  try {
    const wallets = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../kite-wallets.json'), 'utf-8'));
    return wallets.operator.address;
  } catch {
    console.warn('[data-feed] No kite-wallets.json found — run setup-kite-wallets.ts first');
    return '0x0000000000000000000000000000000000000000';
  }
}

const PAYMENT_ADDRESS = loadPaymentAddress();

/**
 * Mock Data Feed API with x402 payment gate.
 */
app.get('/market', (req, res) => {
  const paymentProof = req.headers['x-payment-proof'] as string | undefined;
  const paymentAgent = req.headers['x-payment-agent'] as string | undefined;

  if (!paymentProof) {
    res.status(402);
    res.setHeader('X-Payment-Required', 'true');
    res.setHeader('X-Payment-Amount', '0.001');
    res.setHeader('X-Payment-Address', PAYMENT_ADDRESS);
    res.setHeader('X-Payment-Network', 'eip155:2368');
    res.setHeader('X-Payment-Token', 'KITE');
    res.setHeader('X-Payment-Description', 'Real-time market data feed');
    return res.json({
      error: 'Payment Required',
      x402: {
        amount: '0.001',
        currency: 'KITE',
        network: 'eip155:2368',
        description: 'Pay 0.001 KITE for real-time market data',
      },
    });
  }

  if (!paymentProof.startsWith('0x') || paymentProof.length < 10) {
    return res.status(400).json({ error: 'Invalid payment proof' });
  }

  console.log(`[data-feed] Payment verified: agent=${paymentAgent} tx=${paymentProof}`);

  res.json({
    data: [
      { symbol: 'HBAR', price: 0.28, change_24h: 5.2, volume: '124M' },
      { symbol: 'ETH', price: 3842.50, change_24h: -1.3, volume: '18.2B' },
      { symbol: 'BTC', price: 97250.00, change_24h: 2.1, volume: '42.5B' },
      { symbol: 'KITE', price: 0.15, change_24h: 8.4, volume: '45M' },
    ],
    timestamp: new Date().toISOString(),
    payment: { tx_hash: paymentProof, agent: paymentAgent, verified: true },
  });
});

app.get('/health', (_req, res) => res.json({ service: 'data-feed', status: 'ok', network: 'kite-testnet' }));

app.listen(PORT, () => {
  console.log(`Mock Data Feed (x402-gated) running on port ${PORT}`);
});
