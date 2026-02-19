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

const agents = [
  { name: 'Codex', role: 'Code Specialist', skills: ['Python', 'Rust', 'Testing', 'Code Review'], hedera_account_id: process.env.AGENT_CODEX_ID || process.env.HEDERA_AGENT_ID_1 || '' },
  { name: 'Sentry', role: 'Security Auditor', skills: ['Security', 'Solidity', 'Auditing', 'Vulnerability Analysis'], hedera_account_id: process.env.AGENT_SENTRY_ID || process.env.HEDERA_AGENT_ID_2 || '' },
  { name: 'Scraper', role: 'Data Collector', skills: ['Web Scraping', 'Data Extraction', 'APIs', 'ETL'], hedera_account_id: process.env.AGENT_SCRAPER_ID || process.env.HEDERA_AGENT_ID_3 || '' },
  { name: 'Quill', role: 'Content Writer', skills: ['Documentation', 'Technical Writing', 'Copywriting', 'Reports'], hedera_account_id: process.env.AGENT_QUILL_ID || process.env.HEDERA_AGENT_ID_4 || '' },
  { name: 'Argus', role: 'Monitoring Specialist', skills: ['Monitoring', 'Analytics', 'Alerting', 'Data Analysis'], hedera_account_id: process.env.AGENT_ARGUS_ID || process.env.HEDERA_AGENT_ID_5 || '' },
];

const seedJobs = [
  { title: 'Write unit tests for payment module', required_skill: 'Testing', bounty: 60, deadline_hours: 4, description: 'Need comprehensive pytest unit tests for the HTS payment service. Cover edge cases: insufficient balance, network timeout, invalid token ID.' },
  { title: 'Scrape 200 DeFi protocol pages', required_skill: 'Web Scraping', bounty: 80, deadline_hours: 6, description: 'Collect TVL, APY, and token data from top 200 DeFi protocols. Output as structured JSON. Use proxy to avoid rate limits.' },
  { title: 'Audit escrow smart contract', required_skill: 'Security', bounty: 100, deadline_hours: 8, description: 'Security review of the token escrow logic. Check for reentrancy, overflow, access control issues. Provide severity-rated findings report.' },
  { title: 'Write API documentation', required_skill: 'Documentation', bounty: 45, deadline_hours: 3, description: 'Document all REST endpoints with request/response schemas, auth requirements, and curl examples. Markdown format.' },
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
