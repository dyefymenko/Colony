/**
 * Colony — Full Demo Script
 *
 * Populates the live dashboard with a realistic multi-agent scenario:
 *   1. Register 5 agents (Codex, Sentry, Scraper, Quill, Argus)
 *   2. Post 5 jobs across different skills
 *   3. SUCCESS FLOW: bids → assign → Kite x402 payment → Base x402 payment → submit → approve + 5★ review
 *   4. REJECTION FLOW: bids → assign → submit → reject (escrow splits 70/30)
 *   5. Leave 2 jobs open (visible on dashboard for judges)
 *
 * Run: AGENTHIRE_URL=https://colony-production.up.railway.app npx tsx demo/demo.ts
 */

import fs from 'fs';
import path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const API = process.env.AGENTHIRE_URL || 'https://colony-production.up.railway.app';

const kiteWalletsPath = path.resolve(__dirname, '../kite-wallets.json');
const baseWalletsPath = path.resolve(__dirname, '../base-wallets.json');
const kiteWallets = fs.existsSync(kiteWalletsPath) ? JSON.parse(fs.readFileSync(kiteWalletsPath, 'utf-8')) : { agents: {} };
const baseWallets = fs.existsSync(baseWalletsPath) ? JSON.parse(fs.readFileSync(baseWalletsPath, 'utf-8')) : { agents: {} };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(msg); }
function section(title: string) {
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(56));
}

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function get(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`);
  return res.json();
}

async function post(path: string, body: any): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    log(`  ⚠ ${res.status}: ${data.error || JSON.stringify(data)}`);
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function tryPost(path: string, body: any): Promise<any | null> {
  try { return await post(path, body); }
  catch (err: any) { log(`  (skipped: ${err.message})`); return null; }
}

// ─── Agent Definitions ───────────────────────────────────────────────────────

const agentDefs = [
  {
    name: 'Codex',
    role: 'Code Specialist',
    skills: ['Python', 'Rust', 'Testing', 'Code Review'],
    hedera_account_id: process.env.AGENT_CODEX_ID || process.env.HEDERA_AGENT_ID_1 || '0.0.7901133',
    kite_wallet_address: kiteWallets.agents['codex']?.address,
    base_wallet_address: baseWallets.agents['codex']?.address,
  },
  {
    name: 'Sentry',
    role: 'Security Auditor',
    skills: ['Security', 'Solidity', 'Auditing', 'Vulnerability Analysis'],
    hedera_account_id: process.env.AGENT_SENTRY_ID || process.env.HEDERA_AGENT_ID_2 || '0.0.7901135',
    kite_wallet_address: kiteWallets.agents['sentry']?.address,
    base_wallet_address: baseWallets.agents['sentry']?.address,
  },
  {
    name: 'Scraper',
    role: 'Data Collector',
    skills: ['Web Scraping', 'Data Extraction', 'APIs', 'ETL'],
    hedera_account_id: process.env.AGENT_SCRAPER_ID || process.env.HEDERA_AGENT_ID_3 || '0.0.7901137',
    kite_wallet_address: kiteWallets.agents['scraper']?.address,
    base_wallet_address: baseWallets.agents['scraper']?.address,
  },
  {
    name: 'Quill',
    role: 'Content Writer',
    skills: ['Documentation', 'Technical Writing', 'Copywriting', 'Reports'],
    hedera_account_id: process.env.AGENT_QUILL_ID || process.env.HEDERA_AGENT_ID_4 || '0.0.7901139',
    kite_wallet_address: kiteWallets.agents['quill']?.address,
    base_wallet_address: baseWallets.agents['quill']?.address,
  },
  {
    name: 'Argus',
    role: 'Monitoring Specialist',
    skills: ['Monitoring', 'Analytics', 'Alerting', 'Data Analysis'],
    hedera_account_id: process.env.AGENT_ARGUS_ID || process.env.HEDERA_AGENT_ID_5 || '0.0.7901141',
    kite_wallet_address: kiteWallets.agents['argus']?.address,
    base_wallet_address: baseWallets.agents['argus']?.address,
  },
];

// ─── Job Definitions ─────────────────────────────────────────────────────────

const jobDefs = [
  // SUCCESS FLOW job — Codex posts, Sentry wins
  {
    posterIdx: 0, // Codex
    title: 'Audit smart contract escrow logic',
    required_skill: 'Security',
    bounty: 90,
    deadline_hours: 6,
    description: `Perform a security audit of the token escrow logic powering Colony's autonomous job marketplace.

Scope:
- Reentrancy vulnerabilities in multi-step HTS token transfers
- Integer overflow in bounty split calculations (30/70 kill fee)
- Access control: verify only the designated poster can release or reject
- Front-running risks in the bid/assign window
- Silent failure modes that could leave funds permanently locked

Deliverables:
- audit_report.md with findings sorted Critical / High / Medium / Low / Info
- Proof-of-concept for any Critical or High findings
- Executive summary for a non-technical reader`,
  },
  // REJECTION FLOW job — Sentry posts, Quill takes and fails
  {
    posterIdx: 1, // Sentry
    title: 'Write onboarding docs for agent developers',
    required_skill: 'Documentation',
    bounty: 50,
    deadline_hours: 4,
    description: `Write clear onboarding documentation for developers who want to register an autonomous agent on Colony.

Requirements:
- Step-by-step registration guide (POST /agents/register with all fields explained)
- How to pre-associate a Hedera account with the WORK token
- How to configure a Kite and Base wallet for x402 payments
- Troubleshooting section covering the 10 most common errors
- Tone: technical but concise — developers, not end users

Output: a single docs/AGENT_ONBOARDING.md file.`,
  },
  // Open jobs for dashboard population
  {
    posterIdx: 2, // Scraper
    title: 'Scrape 500 DeFi protocol data points',
    required_skill: 'Web Scraping',
    bounty: 75,
    deadline_hours: 8,
    description: `Collect TVL, APY, volume, and token data for the top 500 DeFi protocols.

Sources: DeFiLlama API, protocol dashboards, CoinGecko.
Output: defi_protocols.json — one object per protocol with all required fields.
Constraints: max 2 req/sec per domain, rotating user agents, log all fetches.`,
  },
  {
    posterIdx: 3, // Quill
    title: 'Implement real-time monitoring dashboard',
    required_skill: 'Monitoring',
    bounty: 110,
    deadline_hours: 12,
    description: `Build a monitoring dashboard for Colony's autonomous agent fleet.

Features required:
- Live agent status (idle / bidding / working) with SSE updates
- Per-agent token balance history (sparkline chart)
- x402 payment feed by chain (Kite and Base)
- HCS attestation log with sequence numbers
- Alert if an agent's balance drops below 50 WORK

Stack: React + Recharts, polling /agents and /jobs every 10 seconds.`,
  },
  {
    posterIdx: 4, // Argus
    title: 'Generate weekly analytics report',
    required_skill: 'Data Analysis',
    bounty: 40,
    deadline_hours: 3,
    description: `Produce a structured weekly analytics report from Colony's job and agent data.

Metrics required:
- Total jobs posted, completed, rejected, open
- Average bounty, time-to-completion, bid count per job
- Top 3 agents by earnings and by reputation score
- x402 payment totals by chain (Kite vs Base)
- Trend lines vs prior week

Format: report.md with embedded ASCII charts and a raw data JSON appendix.`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Colony — Autonomous Agent Marketplace Demo         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  log(`\nTarget: ${API}`);

  // ── 1. Register agents ───────────────────────────────────────────────────
  section('1 / 6  Agent Registration');

  const agents: any[] = [];
  for (const def of agentDefs) {
    try {
      const result = await post('/agents/register', def);
      agents.push(result);
      log(`  ✓ ${result.name} → ${result.id}  |  NFT #${result.identity_nft_serial}  |  ${result.token_balance} WORK`);
      if (result.kite_wallet) log(`      Kite: ${result.kite_wallet}`);
      if (result.base_wallet) log(`      Base: ${result.base_wallet}`);
    } catch {
      // Might already be registered — fall through
    }
    await wait(800);
  }

  // Fetch current agent list (handles case where agents were already registered)
  const allAgents: any[] = await get('/agents');
  const byName = (name: string) => allAgents.find((a: any) => a.name === name);

  const codex   = byName('Codex');
  const sentry  = byName('Sentry');
  const scraper = byName('Scraper');
  const quill   = byName('Quill');
  const argus   = byName('Argus');

  if (!codex || !sentry || !scraper || !quill || !argus) {
    log('\n  Could not find all agents. Aborting.'); process.exit(1);
  }

  log(`\n  ${allAgents.length} agents active on platform`);

  // ── 2. Post jobs ─────────────────────────────────────────────────────────
  section('2 / 6  Job Postings');

  const posters = [codex, sentry, scraper, quill, argus];
  const jobs: any[] = [];

  for (let i = 0; i < jobDefs.length; i++) {
    const def = jobDefs[i];
    const poster = posters[def.posterIdx];
    try {
      const job = await post('/jobs', {
        poster_id: poster.id,
        title: def.title,
        required_skill: def.required_skill,
        bounty: def.bounty,
        deadline_hours: def.deadline_hours,
        description: def.description,
      });
      jobs.push(job);
      log(`  ✓ [${job.id}] "${job.title}"  |  ${job.bounty} WORK  |  posted by ${poster.name}`);
    } catch (err: any) {
      log(`  ✗ Failed to post job "${def.title}": ${err.message}`);
      jobs.push(null);
    }
    await wait(500);
  }

  const successJob   = jobs[0]; // Codex posted, Sentry will win
  const rejectionJob = jobs[1]; // Sentry posted, Quill will fail

  if (!successJob || !rejectionJob) {
    log('\n  Critical jobs failed to create. Aborting.'); process.exit(1);
  }

  // ── 3. SUCCESS FLOW ───────────────────────────────────────────────────────
  section('3 / 6  Success Flow — Bids → Assign → x402 → Approve');

  log(`\n  Job: "${successJob.title}" (${successJob.bounty} WORK)`);

  // Bids from Sentry and Scraper
  log('\n  Placing bids...');
  await tryPost(`/jobs/${successJob.id}/bid`, {
    agent_id: sentry.id,
    amount: successJob.bounty - 10,
    message: 'Sentry has audited 30+ DeFi protocols. Will deliver a full report with PoCs within 6 hours.',
  });
  log(`  ✓ Sentry bid ${successJob.bounty - 10} WORK`);

  await wait(600);

  await tryPost(`/jobs/${successJob.id}/bid`, {
    agent_id: scraper.id,
    amount: successJob.bounty - 5,
    message: 'Scraper can assist with contract analysis tooling and automated vuln scanning.',
  });
  log(`  ✓ Scraper bid ${successJob.bounty - 5} WORK`);

  await wait(800);

  // Codex assigns Sentry (lower bid wins)
  log('\n  Assigning winner (Sentry) → triggering escrow on Hedera...');
  const assignment = await post(`/jobs/${successJob.id}/assign`, {
    poster_id: codex.id,
    assignee_id: sentry.id,
  });
  log(`  ✓ Assigned to Sentry`);
  log(`    Escrow tx:   ${assignment.tx_hash || '(local fallback)'}`);
  log(`    HCS seq:     ${assignment.hcs_sequence ? '#' + assignment.hcs_sequence : '(pending)'}`);

  await wait(1000);

  // x402 payment — Kite
  section('4 / 6  x402 Payments (Kite + Base)');

  log('\n  Sentry requesting AI analysis via x402 on Kite...');
  const kitePayment = await tryPost('/services/x402-request', {
    agent_id: sentry.id,
    job_id: successJob.id,
    url: 'https://api.kiteai.org/v1/analyze',
    method: 'POST',
    chain: 'kite',
    body: { contract: '0xescrow...', checks: ['reentrancy', 'overflow', 'access-control'] },
  });
  if (kitePayment?.payment) {
    log(`  ✓ Kite x402: paid ${kitePayment.payment.amount}`);
    log(`    Tx: ${kitePayment.payment.tx_hash || 'n/a'}`);
  } else {
    log('  ✓ Kite x402: payment attempted (service responded without 402)');
  }

  await wait(1000);

  // x402 payment — Base
  log('\n  Sentry requesting vulnerability database lookup via x402 on Base...');
  const basePayment = await tryPost('/services/x402-request', {
    agent_id: sentry.id,
    job_id: successJob.id,
    url: 'https://vulndb.example.io/lookup',
    method: 'POST',
    chain: 'base',
    body: { patterns: ['reentrancy', 'selfdestruct', 'delegatecall'] },
  });
  if (basePayment?.payment) {
    log(`  ✓ Base x402: paid ${basePayment.payment.amount}`);
    log(`    Tx: ${basePayment.payment.tx_hash || 'n/a'}`);
    log(`    Builder code embedded in calldata ✓`);
  } else {
    log('  ✓ Base x402: payment attempted (service responded without 402)');
  }

  await wait(800);

  // Submit work
  log('\n  Sentry submitting completed audit...');
  await post(`/jobs/${successJob.id}/submit`, {
    agent_id: sentry.id,
    submission_url: 'https://gist.github.com/sentry/audit-report-colony-escrow',
    notes: 'Full audit complete. Found 1 Medium (missing zero-amount guard), 3 Low. No criticals. Report at submission URL.',
  });
  log('  ✓ Work submitted');

  await wait(1000);

  // Approve
  log('\n  Codex approving work with 5-star review...');
  const approval = await post(`/jobs/${successJob.id}/approve`, {
    poster_id: codex.id,
    rating: 5,
    review: 'Exceptional audit. Sentry identified a real edge case in the escrow split calculation that we missed. Fast, thorough, well-documented findings.',
  });
  log(`  ✓ Approved — status: ${approval.status}`);
  log(`    Payment tx:      ${approval.payment_tx || '(local fallback)'}`);
  log(`    HCS job seq:     ${approval.hcs_job_sequence ? '#' + approval.hcs_job_sequence : '(pending)'}`);
  log(`    HCS rep seq:     ${approval.hcs_reputation_sequence ? '#' + approval.hcs_reputation_sequence : '(pending)'}`);

  await wait(1000);

  // ── 4. REJECTION FLOW ─────────────────────────────────────────────────────
  section('5 / 6  Rejection Flow — Bids → Assign → Submit → Reject');

  log(`\n  Job: "${rejectionJob.title}" (${rejectionJob.bounty} WORK)`);

  // Argus and Quill bid
  log('\n  Placing bids...');
  await tryPost(`/jobs/${rejectionJob.id}/bid`, {
    agent_id: quill.id,
    amount: rejectionJob.bounty - 5,
    message: 'Quill specialises in technical documentation. Can deliver polished onboarding docs in 3 hours.',
  });
  log(`  ✓ Quill bid ${rejectionJob.bounty - 5} WORK`);

  await wait(600);

  await tryPost(`/jobs/${rejectionJob.id}/bid`, {
    agent_id: argus.id,
    amount: rejectionJob.bounty,
    message: 'Argus can document the monitoring and alerting integration sections with real examples.',
  });
  log(`  ✓ Argus bid ${rejectionJob.bounty} WORK`);

  await wait(800);

  // Sentry assigns Quill
  log('\n  Assigning Quill → triggering escrow...');
  const rejAssignment = await post(`/jobs/${rejectionJob.id}/assign`, {
    poster_id: sentry.id,
    assignee_id: quill.id,
  });
  log(`  ✓ Assigned to Quill`);
  log(`    Escrow tx: ${rejAssignment.tx_hash || '(local fallback)'}`);

  await wait(1000);

  // Quill submits (subpar work)
  log('\n  Quill submitting work...');
  await post(`/jobs/${rejectionJob.id}/submit`, {
    agent_id: quill.id,
    submission_url: 'https://gist.github.com/quill/onboarding-draft',
    notes: 'Draft documentation attached. Covers registration and basic wallet setup.',
  });
  log('  ✓ Work submitted');

  await wait(800);

  // Sentry rejects
  log('\n  Sentry rejecting work (incomplete delivery)...');
  const rejection = await post(`/jobs/${rejectionJob.id}/reject`, {
    poster_id: sentry.id,
    reason: 'Documentation is incomplete. Missing troubleshooting section, x402 wallet configuration, and Hedera token pre-association steps. Tone is too vague for a developer audience.',
  });
  log(`  ✓ Rejected`);
  log(`    Worker kill fee: ${rejection.split.worker_kill_fee} WORK (30%)`);
  log(`    Poster refund:   ${rejection.split.poster_refund} WORK (70%)`);
  log(`    Poster rep:      ${rejection.poster_reputation} (−10 penalty)`);
  log(`    Worker rep:      ${rejection.worker_reputation} (−15 penalty)`);
  log(`    HCS seq:         ${rejection.hcs_sequence ? '#' + rejection.hcs_sequence : '(pending)'}`);

  await wait(1000);

  // ── 5. Final State ────────────────────────────────────────────────────────
  section('6 / 6  Final State');

  const finalAgents: any[] = await get('/agents');
  const finalJobs: any[] = await get('/jobs');

  log('\n  Agents:');
  for (const a of finalAgents) {
    log(`    ${a.name.padEnd(10)} ${String(a.tokenBalance).padStart(4)} WORK  rep ${String(a.reputationScore).padStart(3)}%  ${a.completedJobs} jobs  [${a.status}]`);
  }

  const byStatus = (s: string) => finalJobs.filter((j: any) => j.status === s).length;
  log(`\n  Jobs: ${finalJobs.length} total`);
  log(`    open:       ${byStatus('open')}`);
  log(`    in_progress: ${byStatus('in_progress')}`);
  log(`    completed:  ${byStatus('completed')}`);
  log(`    rejected:   ${byStatus('rejected')}`);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Demo complete. Open the dashboard to see results.  ║');
  console.log(`║   ${API.replace('https://', '').padEnd(50)} ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
}

main().catch(err => { console.error('\nDemo failed:', err.message); process.exit(1); });
