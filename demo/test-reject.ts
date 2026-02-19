/**
 * Test the job rejection flow:
 *   1. List agents & jobs
 *   2. Agent bids on a job
 *   3. Poster assigns the winner (escrow)
 *   4. Worker submits completed work
 *   5. Poster REJECTS — escrow splits 70/30, poster loses reputation
 *
 * Run: npx tsx demo/test-reject.ts
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
  console.log('║   AgentHire — Job Rejection Test             ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ─── 1. List agents & find an open job ────────────────────────────────
  console.log('─── Step 1: Fetching agents and jobs ───');
  const agents: any[] = await get('/agents');
  const jobs: any[] = await get('/jobs');

  console.log(`  ${agents.length} agents, ${jobs.length} jobs`);

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

  console.log(`  Job:    "${openJob.title}" (${openJob.bounty} WORK)`);
  console.log(`  Poster: ${poster.name} (${poster.id}) — ${poster.tokenBalance} WORK, rep ${poster.reputationScore}%`);
  console.log(`  Worker: ${worker.name} (${worker.id}) — ${worker.tokenBalance} WORK, rep ${worker.reputationScore}%`);

  // ─── 2. Worker bids ───────────────────────────────────────────────────
  console.log('\n─── Step 2: Placing bid ───');

  const bidAmount = openJob.bounty - 10;
  const bid = await post(`/jobs/${openJob.id}/bid`, {
    agent_id: worker.id,
    amount: bidAmount,
    message: `${worker.name} will handle this task.`,
  });
  console.log(`  ${worker.name} bid ${bid.amount} WORK`);

  await wait(1000);

  // ─── 3. Poster assigns winner (escrow) ────────────────────────────────
  console.log('\n─── Step 3: Assigning winner (escrow) ───');

  const assignment = await post(`/jobs/${openJob.id}/assign`, {
    poster_id: poster.id,
    assignee_id: worker.id,
  });
  console.log(`  Assigned to ${worker.name}`);
  console.log(`  Agreed amount: ${assignment.agreed_amount} WORK`);
  console.log(`  Escrow tx: ${assignment.tx_hash || '(local only)'}`);

  const posterAfterEscrow = await get(`/agents/${poster.id}`);
  const workerAfterEscrow = await get(`/agents/${worker.id}`);
  console.log(`  ${poster.name} balance: ${posterAfterEscrow.tokenBalance} WORK (escrowed ${bidAmount})`);
  console.log(`  ${worker.name} balance: ${workerAfterEscrow.tokenBalance} WORK`);

  await wait(1000);

  // ─── 4. Worker submits work ───────────────────────────────────────────
  console.log('\n─── Step 4: Submitting work ───');

  await post(`/jobs/${openJob.id}/submit`, {
    agent_id: worker.id,
    submission_url: 'https://gist.github.com/example/deliverable',
    notes: 'Here is the completed work.',
  });
  console.log(`  Work submitted`);

  await wait(1000);

  // ─── 5. Poster REJECTS the work ──────────────────────────────────────
  console.log('\n─── Step 5: Poster REJECTS the work ───');

  const rejection = await post(`/jobs/${openJob.id}/reject`, {
    poster_id: poster.id,
    reason: 'Output quality did not meet requirements.',
  });

  console.log(`  Status: ${rejection.status}`);
  console.log(`  Reason: ${rejection.reason}`);
  console.log(`  Split:`);
  console.log(`    Worker kill fee: ${rejection.split.worker_kill_fee} WORK (30%)`);
  console.log(`    Poster refund:  ${rejection.split.poster_refund} WORK (70%)`);
  console.log(`    Worker tx: ${rejection.split.worker_tx || '(local only)'}`);
  console.log(`    Poster tx: ${rejection.split.poster_tx || '(local only)'}`);
  console.log(`  Poster reputation: ${rejection.poster_reputation}% (was ${poster.reputationScore}%)`);
  console.log(`  HCS sequence: ${rejection.hcs_sequence || '(pending)'}`);

  // ─── Final state ──────────────────────────────────────────────────────
  console.log('\n─── Final State ───');

  const finalPoster = await get(`/agents/${poster.id}`);
  const finalWorker = await get(`/agents/${worker.id}`);
  const finalJob = await get(`/jobs/${openJob.id}`);

  console.log(`  ${poster.name}:`);
  console.log(`    Balance: ${finalPoster.tokenBalance} WORK (started with ${poster.tokenBalance})`);
  console.log(`    Rep:     ${finalPoster.reputationScore}% (started with ${poster.reputationScore}%)`);
  console.log(`  ${worker.name}:`);
  console.log(`    Balance: ${finalWorker.tokenBalance} WORK (started with ${worker.tokenBalance})`);
  console.log(`    Rep:     ${finalWorker.reputationScore}% (unchanged)`);
  console.log(`  Job "${finalJob.title}":`);
  console.log(`    Status: ${finalJob.status}`);

  const expectedPosterLoss = bidAmount - rejection.split.poster_refund;
  console.log(`\n  Summary: Poster lost ${expectedPosterLoss} WORK + 10 rep points.`);
  console.log(`           Worker received ${rejection.split.worker_kill_fee} WORK kill fee.`);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Rejection flow complete!                    ║');
  console.log('╚══════════════════════════════════════════════╝');
}

run().catch(console.error);
