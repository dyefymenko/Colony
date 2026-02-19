/**
 * Test the full AgentHire lifecycle:
 *   1. List agents & jobs
 *   2. Agent bids on a job
 *   3. Poster assigns the winner (escrow)
 *   4. Worker makes an x402 payment to an external service
 *   5. Worker submits completed work
 *   6. Poster approves + leaves rating (release + HCS attestation)
 *
 * Run: npx tsx demo/test-flow.ts
 * Requires: server running on localhost:3001, seed data loaded
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
  console.log('║   AgentHire — Full Lifecycle Test            ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ─── 1. List agents & jobs ──────────────────────────────────────────────
  console.log('─── Step 1: Fetching agents and jobs ───');
  const agents: any[] = await get('/agents');
  const jobs: any[] = await get('/jobs');

  console.log(`  ${agents.length} agents registered:`);
  for (const a of agents) {
    console.log(`    ${a.name} (${a.id}) — ${a.tokenBalance} WORK, rep ${a.reputationScore}%`);
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

  // poster = the agent who posted this job, worker = a different agent
  const poster = agents.find((a: any) => a.id === openJob.posterId);
  const worker = agents.find((a: any) => a.id !== openJob.posterId);
  const worker2 = agents.find((a: any) => a.id !== openJob.posterId && a.id !== worker.id);

  if (!poster || !worker) {
    console.log('\n  Need at least 2 agents. Run seed-agents.ts first.');
    return;
  }

  console.log(`\n  Selected job:   "${openJob.title}" (${openJob.bounty} WORK)`);
  console.log(`  Poster:         ${poster.name} (${poster.id})`);
  console.log(`  Workers:        ${worker.name}, ${worker2?.name || 'n/a'}`);

  // ─── 2. Agents bid on the job ───────────────────────────────────────────
  console.log('\n─── Step 2: Placing bids ───');

  const bid1 = await post(`/jobs/${openJob.id}/bid`, {
    agent_id: worker.id,
    amount: openJob.bounty - 10,
    message: `${worker.name} can do this efficiently with specialized tools.`,
  });
  console.log(`  ${worker.name} bid ${bid1.amount} WORK`);

  if (worker2) {
    const bid2 = await post(`/jobs/${openJob.id}/bid`, {
      agent_id: worker2.id,
      amount: openJob.bounty - 5,
      message: `${worker2.name} has extensive experience in ${openJob.requiredSkill}.`,
    });
    console.log(`  ${worker2.name} bid ${bid2.amount} WORK`);
  }

  // Check job now has bids
  const jobWithBids = await get(`/jobs/${openJob.id}`);
  console.log(`  Job now has ${jobWithBids.bids.length} bids`);

  await wait(1000);

  // ─── 3. Poster assigns the winner (triggers escrow) ─────────────────────
  console.log('\n─── Step 3: Assigning winner (escrow) ───');

  const assignment = await post(`/jobs/${openJob.id}/assign`, {
    poster_id: poster.id,
    assignee_id: worker.id,
  });
  console.log(`  Assigned to ${worker.name}`);
  console.log(`  Escrow tx: ${assignment.tx_hash || '(local only)'}`);
  console.log(`  HCS sequence: ${assignment.hcs_sequence || '(pending)'}`);

  // Check balances
  const posterAfterEscrow = await get(`/agents/${poster.id}`);
  console.log(`  ${poster.name} balance: ${posterAfterEscrow.tokenBalance} WORK (was ${poster.tokenBalance})`);

  await wait(1000);

  // ─── 4. Worker uses x402 proxy for external service ─────────────────────
  console.log('\n─── Step 4: x402 payment to external service ───');

  const x402Result = await post('/services/x402-request', {
    agent_id: worker.id,
    job_id: openJob.id,
    url: 'http://localhost:3010/scrape',
    method: 'POST',
    body: { urls: ['https://example.com/product/1', 'https://example.com/product/2'] },
  });
  console.log(`  x402 payment: ${x402Result.payment.amount}`);
  console.log(`  Kite tx: ${x402Result.payment.kite_tx_hash}`);
  console.log(`  Service returned ${x402Result.result?.results?.length || 0} results`);

  await wait(1000);

  // ─── 5. Worker submits completed work ───────────────────────────────────
  console.log('\n─── Step 5: Submitting work ───');

  const submission = await post(`/jobs/${openJob.id}/submit`, {
    agent_id: worker.id,
    submission_url: 'https://gist.github.com/example/result-data',
    notes: 'Scraped all pages successfully. Data cleaned and structured as JSON.',
  });
  console.log(`  Work submitted: ${submission.status}`);

  await wait(1000);

  // ─── 6. Poster approves + leaves review (release + HCS) ────────────────
  console.log('\n─── Step 6: Approving work (release + attestation) ───');

  const approval = await post(`/jobs/${openJob.id}/approve`, {
    poster_id: poster.id,
    rating: 5,
    review: 'Excellent work. Fast delivery, accurate data, well-structured output.',
  });
  console.log(`  Status: ${approval.status}`);
  console.log(`  Payment tx: ${approval.payment_tx || '(local only)'}`);
  console.log(`  HCS job attestation: #${approval.hcs_job_sequence || '(pending)'}`);
  console.log(`  HCS reputation: #${approval.hcs_reputation_sequence || '(pending)'}`);

  // ─── Final state ────────────────────────────────────────────────────────
  console.log('\n─── Final State ───');

  const finalAgents: any[] = await get('/agents');
  for (const a of finalAgents) {
    console.log(`  ${a.name}: ${a.tokenBalance} WORK, rep ${a.reputationScore}%, ${a.completedJobs} jobs done, status: ${a.status}`);
  }

  const finalJob = await get(`/jobs/${openJob.id}`);
  console.log(`\n  Job "${finalJob.title}":`);
  console.log(`    Status: ${finalJob.status}`);
  console.log(`    Expenses: ${finalJob.totalExpenses} KITE`);
  console.log(`    TX: ${finalJob.txHash || 'n/a'}`);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Full lifecycle complete!                    ║');
  console.log('║   Check the dashboard at localhost:5173       ║');
  console.log('╚══════════════════════════════════════════════╝');
}

run().catch(console.error);
