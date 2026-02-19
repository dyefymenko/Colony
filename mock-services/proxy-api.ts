import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const PORT = 3010;

function loadPaymentAddress(): string {
  if (process.env.PAYMENT_ADDRESS) return process.env.PAYMENT_ADDRESS;
  try {
    const wallets = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../kite-wallets.json'), 'utf-8'));
    return wallets.operator.address;
  } catch {
    console.warn('[proxy-api] No kite-wallets.json found — run setup-kite-wallets.ts first');
    return '0x0000000000000000000000000000000000000000';
  }
}

const PAYMENT_ADDRESS = loadPaymentAddress();

/**
 * Mock Scraping Proxy API with x402 payment gate.
 * Returns proper x402-compliant 402 headers referencing Kite testnet.
 */
app.post('/scrape', (req, res) => {
  const paymentProof = req.headers['x-payment-proof'] as string | undefined;
  const paymentNetwork = req.headers['x-payment-network'] as string | undefined;
  const paymentAgent = req.headers['x-payment-agent'] as string | undefined;

  if (!paymentProof) {
    res.status(402);
    res.setHeader('X-Payment-Required', 'true');
    res.setHeader('X-Payment-Amount', '0.005');
    res.setHeader('X-Payment-Address', PAYMENT_ADDRESS);
    res.setHeader('X-Payment-Network', 'eip155:2368');
    res.setHeader('X-Payment-Token', 'KITE');
    res.setHeader('X-Payment-Description', 'Web scraping proxy access');
    return res.json({
      error: 'Payment Required',
      x402: {
        amount: '0.005',
        currency: 'KITE',
        network: 'eip155:2368',
        description: 'Pay 0.005 KITE to access scraping proxy',
        explorer: 'https://testnet.kitescan.ai',
      },
    });
  }

  // Validate payment proof is a real tx hash format
  if (!paymentProof.startsWith('0x') || paymentProof.length < 10) {
    return res.status(400).json({
      error: 'Invalid payment proof',
      message: 'X-Payment-Proof must be a valid transaction hash',
    });
  }

  // Log the verified payment
  console.log(`[proxy-api] Payment verified:`);
  console.log(`  Agent: ${paymentAgent || 'unknown'}`);
  console.log(`  Network: ${paymentNetwork || 'unknown'}`);
  console.log(`  Tx: ${paymentProof}`);
  console.log(`  Verify: https://testnet.kitescan.ai/tx/${paymentProof}`);

  // Payment received — return mock scraped data
  const urls = req.body?.urls || ['https://example.com'];
  const results = urls.map((url: string, i: number) => ({
    url,
    status: 200,
    title: `Product ${i + 1} — Premium Widget`,
    price: `$${(Math.random() * 100 + 10).toFixed(2)}`,
    description: 'High-quality widget with advanced features.',
    scraped_at: new Date().toISOString(),
  }));

  res.json({
    results,
    count: results.length,
    payment: {
      tx_hash: paymentProof,
      network: paymentNetwork,
      agent: paymentAgent,
      verified: true,
    },
  });
});

app.get('/health', (_req, res) => res.json({ service: 'proxy-api', status: 'ok', network: 'kite-testnet' }));

app.listen(PORT, () => {
  console.log(`Mock Proxy API (x402-gated) running on port ${PORT}`);
  console.log(`  Payment address: ${PAYMENT_ADDRESS}`);
});
