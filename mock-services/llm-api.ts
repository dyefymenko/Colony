import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const PORT = 3011;

function loadPaymentAddress(): string {
  if (process.env.PAYMENT_ADDRESS) return process.env.PAYMENT_ADDRESS;
  try {
    const wallets = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../kite-wallets.json'), 'utf-8'));
    return wallets.operator.address;
  } catch {
    console.warn('[llm-api] No kite-wallets.json found — run setup-kite-wallets.ts first');
    return '0x0000000000000000000000000000000000000000';
  }
}

const PAYMENT_ADDRESS = loadPaymentAddress();

/**
 * Mock LLM Inference API with x402 payment gate.
 */
app.post('/generate', (req, res) => {
  const paymentProof = req.headers['x-payment-proof'] as string | undefined;
  const paymentAgent = req.headers['x-payment-agent'] as string | undefined;

  if (!paymentProof) {
    res.status(402);
    res.setHeader('X-Payment-Required', 'true');
    res.setHeader('X-Payment-Amount', '0.002');
    res.setHeader('X-Payment-Address', PAYMENT_ADDRESS);
    res.setHeader('X-Payment-Network', 'eip155:2368');
    res.setHeader('X-Payment-Token', 'KITE');
    res.setHeader('X-Payment-Description', 'LLM inference request');
    return res.json({
      error: 'Payment Required',
      x402: {
        amount: '0.002',
        currency: 'KITE',
        network: 'eip155:2368',
        description: 'Pay 0.002 KITE for LLM inference',
      },
    });
  }

  if (!paymentProof.startsWith('0x') || paymentProof.length < 10) {
    return res.status(400).json({ error: 'Invalid payment proof' });
  }

  console.log(`[llm-api] Payment verified: agent=${paymentAgent} tx=${paymentProof}`);

  const prompt = req.body?.prompt || 'Hello';
  const responses: Record<string, string> = {
    'write unit tests': 'Generated 12 unit tests covering edge cases for the authentication module.',
    'audit smart contract': 'Security audit complete. Found 2 medium-severity issues: unchecked return value on L45, potential reentrancy on L112.',
    'generate documentation': 'API documentation generated for 8 endpoints with request/response schemas.',
  };

  const matchedKey = Object.keys(responses).find((k) => prompt.toLowerCase().includes(k));
  const text = matchedKey ? responses[matchedKey] : `Processed: "${prompt}". Generated comprehensive analysis.`;

  res.json({
    text,
    model: 'mock-llm-v1',
    tokens_used: Math.floor(Math.random() * 500 + 100),
    payment: { tx_hash: paymentProof, agent: paymentAgent, verified: true },
  });
});

app.get('/health', (_req, res) => res.json({ service: 'llm-api', status: 'ok', network: 'kite-testnet' }));

app.listen(PORT, () => {
  console.log(`Mock LLM API (x402-gated) running on port ${PORT}`);
});
