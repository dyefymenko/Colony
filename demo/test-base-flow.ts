/**
 * Test the AgentHire lifecycle with Base Sepolia x402 payments:
 *   1. List agents & jobs
 *   2. Agent bids on a job
 *   3. Poster assigns the winner (escrow)
 *   4. Worker makes an x402 payment to a Base-gated external service
 *   5. Worker submits completed work
 *   6. Poster approves + leaves rating (release + HCS attestation)
 *
 * Run:
 *   1. Start server:              cd server && npm run dev
 *   2. Seed data (if needed):     npx tsx demo/seed-agents.ts
 *   3. Start Base mock service:   cd mock-services && npx tsx base-data-feed.ts
 *   4. Run this demo:             npx tsx demo/test-base-flow.ts
 *
 * Requires: server on localhost:3001, seed data loaded,
 *           mock Base data feed on localhost:3013
 */

const API = 'http://localhost:3001';

async function get(path: string) {
  const res = await fetch(`${API}${path}`);
  return res.json();
}

async function post(path: string, body: any) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`  ERROR ${res.status}:`, data);
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   AgentHire — Base Sepolia x402 Flow Test    ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ─── 1. List agents & jobs ──────────────────────────────────────────────
  console.log('─── Step 1: Fetching agents and jobs ───');
  const agents: any[] = await get('/agents');
  const jobs: any[] = await get('/jobs');

  console.log(`  ${agents.length} agents registered:`);
  for (const a of agents) {
    console.log(`    ${a.name} (${a.id}) — ${a.tokenBalance} WORK, rep ${a.reputationScore}%`);
    if (a.baseWalletAddress) {
      console.log(`      Base wallet: ${a.baseWalletAddress}`);
    }
  }
  console.log(`  ${jobs.length} jobs:`);
  for (const j of jobs) {
    console.log(`    [${j.status}] "${j.title}" — ${j.bounty} WORK (${j.id})`);
  }

  // Pick an open job and two agents
  const openJob = jobs.find((j: any) => j.status === 'open');
  if (!openJob) {
    console.log('\n  No open jobs found. Run seed-agents.ts first.');
    return;
  }

  const poster = agents.find((a: any) => a.id === openJob.posterId);
  const worker = agents.find((a: any) => a.id !== openJob.posterId);

  if (!poster || !worker) {
    console.log('\n  Need at least 2 agents. Run seed-agents.ts first.');
    return;
  }

  console.log(`\n  Selected job:   "${openJob.title}" (${openJob.bounty} WORK)`);
  console.log(`  Skill:          ${openJob.requiredSkill}`);
  console.log(`  Description:\n${openJob.description.split('\n').map((l: string) => `    ${l}`).join('\n')}`);
  console.log(`  Poster:         ${poster.name} (${poster.id})`);
  console.log(`  Worker:         ${worker.name} (${worker.id})`);

  // ─── 2. Agent bids on the job ─────────────────────────────────────────
  console.log('\n─── Step 2: Placing bid ───');

  const bid = await post(`/jobs/${openJob.id}/bid`, {
    agent_id: worker.id,
    amount: openJob.bounty - 10,
    message: `${worker.name} can handle this using Base-powered data feeds.`,
  });
  console.log(`  ${worker.name} bid ${bid.amount} WORK`);

  const jobWithBids = await get(`/jobs/${openJob.id}`);
  console.log(`  Job now has ${jobWithBids.bids.length} bid(s)`);

  await wait(1000);

  // ─── 3. Poster assigns the winner (triggers escrow) ───────────────────
  console.log('\n─── Step 3: Assigning winner (escrow) ───');

  const assignment = await post(`/jobs/${openJob.id}/assign`, {
    poster_id: poster.id,
    assignee_id: worker.id,
  });
  console.log(`  Assigned to ${worker.name}`);
  console.log(`  Escrow tx: ${assignment.tx_hash || '(local only)'}`);
  console.log(`  HCS sequence: ${assignment.hcs_sequence || '(pending)'}`);

  const posterAfterEscrow = await get(`/agents/${poster.id}`);
  console.log(`  ${poster.name} balance: ${posterAfterEscrow.tokenBalance} WORK (was ${poster.tokenBalance})`);

  await wait(1000);

  // ─── 4. Worker uses x402 proxy on BASE chain ─────────────────────────
  console.log('\n─── Step 4: x402 payment on BASE SEPOLIA ───');

  const x402Result = await post('/services/x402-request', {
    agent_id: worker.id,
    job_id: openJob.id,
    url: 'http://localhost:3013/market',
    method: 'GET',
    chain: 'base',
  });
  console.log(`  Chain:   ${x402Result.payment.chain}`);
  console.log(`  Network: ${x402Result.payment.network}`);
  console.log(`  Amount:  ${x402Result.payment.amount}`);
  console.log(`  Tx hash: ${x402Result.payment.tx_hash}`);
  console.log(`  Tx URL:  ${x402Result.payment.tx_url}`);
  console.log(`  Service returned ${x402Result.result?.data?.length || 0} market entries`);

  // Verify the expense was logged
  const jobAfterPayment = await get(`/jobs/${openJob.id}`);
  console.log(`  Job expenses: ${jobAfterPayment.totalExpenses}`);
  if (jobAfterPayment.expenses?.length) {
    const lastExpense = jobAfterPayment.expenses[jobAfterPayment.expenses.length - 1];
    console.log(`  Last expense: ${lastExpense.amount} to ${lastExpense.service}`);
  }

  await wait(1000);

  // ─── 5. Worker submits completed work ─────────────────────────────────
  console.log('\n─── Step 5: Submitting work ───');

  const submission = await post(`/jobs/${openJob.id}/submit`, {
    agent_id: worker.id,
    submission_url: 'https://gist.github.com/example/base-market-analysis',
    notes: 'Fetched market data via Base x402 service. Analysis complete.',
  });
  console.log(`  Work submitted: ${submission.status}`);

  await wait(1000);

  // ─── 6. Poster approves + leaves review (release + HCS) ──────────────
  console.log('\n─── Step 6: Approving work (release + attestation) ───');

  const approval = await post(`/jobs/${openJob.id}/approve`, {
    poster_id: poster.id,
    rating: 5,
    review: 'Great work. Used Base Sepolia x402 payments seamlessly for data acquisition.',
  });
  console.log(`  Status: ${approval.status}`);
  console.log(`  Payment tx: ${approval.payment_tx || '(local only)'}`);
  console.log(`  HCS job attestation: #${approval.hcs_job_sequence || '(pending)'}`);
  console.log(`  HCS reputation: #${approval.hcs_reputation_sequence || '(pending)'}`);

  // ─── Final state ──────────────────────────────────────────────────────
  console.log('\n─── Final State ───');

  const finalAgents: any[] = await get('/agents');
  for (const a of finalAgents) {
    console.log(`  ${a.name}: ${a.tokenBalance} WORK, rep ${a.reputationScore}%, ${a.completedJobs} jobs done, status: ${a.status}`);
  }

  const finalJob = await get(`/jobs/${openJob.id}`);
  console.log(`\n  Job "${finalJob.title}":`);
  console.log(`    Status: ${finalJob.status}`);
  console.log(`    Expenses: ${finalJob.totalExpenses}`);
  console.log(`    TX: ${finalJob.txHash || 'n/a'}`);

  // Show Base wallet info
  console.log('\n─── Base Sepolia Wallets ───');
  try {
    const baseWallets = await get('/services/base-wallets');
    for (const w of baseWallets.wallets || []) {
      console.log(`  ${w.name}: ${w.address} (${w.balance})`);
    }
  } catch {
    console.log('  (Base wallets not configured)');
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Base Sepolia x402 flow complete!            ║');
  console.log('║   Check the dashboard at localhost:5173        ║');
  console.log('╚══════════════════════════════════════════════╝');
}

run().catch(console.error);
