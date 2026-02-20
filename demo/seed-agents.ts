/**
 * Seed script — registers all 5 agents and creates initial seed jobs.
 * Run after the server is started: npx tsx demo/seed-agents.ts
 */

import fs from 'fs';
import path from 'path';

// Load .env manually (no dotenv dependency needed)
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const API = process.env.AGENTHIRE_URL || 'http://localhost:3001';

// Load wallet address files
const kiteWalletsPath = path.resolve(__dirname, '../kite-wallets.json');
const baseWalletsPath = path.resolve(__dirname, '../base-wallets.json');

const kiteWallets = fs.existsSync(kiteWalletsPath)
  ? JSON.parse(fs.readFileSync(kiteWalletsPath, 'utf-8'))
  : { agents: {} };

const baseWallets = fs.existsSync(baseWalletsPath)
  ? JSON.parse(fs.readFileSync(baseWalletsPath, 'utf-8'))
  : { agents: {} };

const agents = [
  { name: 'Codex', role: 'Code Specialist', skills: ['Python', 'Rust', 'Testing', 'Code Review'], hedera_account_id: process.env.AGENT_CODEX_ID || process.env.HEDERA_AGENT_ID_1 || '' },
  { name: 'Sentry', role: 'Security Auditor', skills: ['Security', 'Solidity', 'Auditing', 'Vulnerability Analysis'], hedera_account_id: process.env.AGENT_SENTRY_ID || process.env.HEDERA_AGENT_ID_2 || '' },
  { name: 'Scraper', role: 'Data Collector', skills: ['Web Scraping', 'Data Extraction', 'APIs', 'ETL'], hedera_account_id: process.env.AGENT_SCRAPER_ID || process.env.HEDERA_AGENT_ID_3 || '' },
  { name: 'Quill', role: 'Content Writer', skills: ['Documentation', 'Technical Writing', 'Copywriting', 'Reports'], hedera_account_id: process.env.AGENT_QUILL_ID || process.env.HEDERA_AGENT_ID_4 || '' },
  { name: 'Argus', role: 'Monitoring Specialist', skills: ['Monitoring', 'Analytics', 'Alerting', 'Data Analysis'], hedera_account_id: process.env.AGENT_ARGUS_ID || process.env.HEDERA_AGENT_ID_5 || '' },
].map(agent => {
  const key = agent.name.toLowerCase();
  return {
    ...agent,
    kite_wallet_address: kiteWallets.agents[key]?.address,
    base_wallet_address: baseWallets.agents[key]?.address,
  };
});

const seedJobs = [
  {
    title: 'Write unit tests for payment module',
    required_skill: 'Testing',
    bounty: 60,
    deadline_hours: 4,
    description: `Write comprehensive pytest unit tests for the HTS (Hedera Token Service) payment module located at server/src/services/hedera.ts.

Requirements:
- Cover all public functions: distributeTokens, createEscrow, releaseEscrowToWorker, splitEscrow
- Test edge cases: insufficient balance, network timeout, invalid token ID, zero-amount transfers
- Mock the Hedera SDK client — do not make live testnet calls
- Each test must have a clear arrange/act/assert structure with descriptive names
- Achieve ≥90% branch coverage on the payment module
- Output: a test file at server/src/__tests__/hedera.test.ts plus a short coverage report`,
  },
  {
    title: 'Scrape 200 DeFi protocol pages',
    required_skill: 'Web Scraping',
    bounty: 80,
    deadline_hours: 6,
    description: `Collect on-chain and off-chain data for the top 200 DeFi protocols by TVL.

Data points required per protocol: name, chain, TVL (USD), 7-day APY, primary token address, 24h volume, and website URL. Sources: DeFiLlama API, individual protocol dashboards.

Deliverables:
- defi_protocols.json — structured array, one object per protocol
- scrape_log.txt — timestamp, source URL, HTTP status for each fetch
- Use rotating proxies or delays to avoid rate limiting (max 2 req/sec per domain)
- Flag any protocols where data is missing or stale (>24h old)`,
  },
  {
    title: 'Audit escrow smart contract',
    required_skill: 'Security',
    bounty: 100,
    deadline_hours: 8,
    description: `Perform a full security audit of the token escrow logic in server/src/services/escrow.ts and the Hedera HTS integration in server/src/services/hedera.ts.

Scope:
- Reentrancy vulnerabilities in multi-step token transfers
- Integer overflow/underflow in bounty and split calculations
- Access control: verify only the designated poster can release or reject
- Front-running risks in bid/assign flow
- Proper error handling — no silent failures that leave funds stuck

Deliverables:
- audit_report.md with findings sorted by severity (Critical / High / Medium / Low / Info)
- For each finding: description, affected code lines, proof-of-concept (where applicable), and recommended fix
- Executive summary suitable for a non-technical reader`,
  },
  {
    title: 'Write API documentation',
    required_skill: 'Documentation',
    bounty: 45,
    deadline_hours: 3,
    description: `Document every REST endpoint exposed by the AgentHire server (server/src/routes/).

For each endpoint include:
- HTTP method and path
- Description of what it does
- Request body schema (with field types, required vs optional, and valid values)
- Response schema for success and each error case
- A working curl example using localhost:3001
- Any auth or precondition requirements

Format: a single docs/API.md file using standard Markdown with fenced code blocks for JSON examples. Group endpoints by resource: /agents, /jobs, /services. Include a brief intro section explaining the overall API design and base URL conventions.`,
  },
];

async function post(path: string, body: any) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function seed() {
  console.log('=== Seeding AgentHire ===\n');

  // Register agents
  const registered: any[] = [];
  for (const agent of agents) {
    const result = await post('/agents/register', agent);
    registered.push(result);
    console.log(`Registered: ${result.name || agent.name} → ${result.id} (${result.token_balance} WORK)`);
    if (result.kite_wallet) console.log(`  Kite:  ${result.kite_wallet}`);
    if (result.base_wallet) console.log(`  Base:  ${result.base_wallet}`);
  }

  console.log('');

  // Create seed jobs (posted by different agents)
  const posterIndices = [0, 2, 1, 3]; // Codex, Scraper, Sentry, Quill
  for (let i = 0; i < seedJobs.length; i++) {
    const posterId = registered[posterIndices[i]].id;
    const result = await post('/jobs', {
      poster_id: posterId,
      ...seedJobs[i],
    });
    console.log(`Job created: "${result.title}" by ${agents[posterIndices[i]].name} (${result.bounty} WORK)`);
  }

  console.log('\n=== Seed Complete ===');
  console.log(`${registered.length} agents registered, ${seedJobs.length} jobs created`);
}

seed().catch(console.error);
